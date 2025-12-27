import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
const convertedDir = path.join(process.cwd(), "converted");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 200 * 1024 * 1024 }, // per file
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new Error("Only PDF files allowed"));
    cb(null, true);
  },
});

async function safeUnlink(p) {
  try { await fsp.unlink(p); } catch {}
}

// POST /bulk-rename-pdf
// form-data:
//  - pdfs: multiple pdfs
//  - mode: "prefix" | "suffix" | "both" | "number"
//  - prefix: string
//  - suffix: string
//  - baseName: string (used for number mode)
//  - start: number (used for number mode)
//  - pad: number (used for number mode, e.g. 3 => 001)
router.post("/", upload.array("pdfs"), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).send("No PDFs uploaded");

  const mode = String(req.body.mode || "number");
  const prefix = String(req.body.prefix || "").trim();
  const suffix = String(req.body.suffix || "").trim();
  const baseName = String(req.body.baseName || "file").trim() || "file";
  const start = Number(req.body.start ?? 1);
  const pad = Math.min(6, Math.max(1, Number(req.body.pad ?? 3)));

  const zipName = `bulk_rename_${Date.now()}.zip`;
  const zipPath = path.join(convertedDir, zipName);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", async (err) => {
    console.error("Bulk rename archiver error:", err);
    try { archive.abort(); } catch {}
    for (const f of files) await safeUnlink(f.path);
    await safeUnlink(zipPath);
    if (!res.headersSent) res.status(500).send("Bulk rename failed (zip error)");
  });

  output.on("error", async (err) => {
    console.error("Bulk rename output error:", err);
    for (const f of files) await safeUnlink(f.path);
    await safeUnlink(zipPath);
    if (!res.headersSent) res.status(500).send("Bulk rename failed (write error)");
  });

  output.on("close", async () => {
    res.download(zipPath, zipName, async () => {
      await safeUnlink(zipPath);
    });
  });

  archive.pipe(output);

  try {
    let counter = Number.isFinite(start) && start > 0 ? start : 1;

    for (const file of files) {
      const original = file.originalname || "file.pdf";
      const ext = ".pdf";
      const originalBase = original.toLowerCase().endsWith(ext)
        ? original.slice(0, -ext.length)
        : original;

      let newName = "";

      if (mode === "prefix") {
        newName = `${prefix}${originalBase}${ext}`;
      } else if (mode === "suffix") {
        newName = `${originalBase}${suffix}${ext}`;
      } else if (mode === "both") {
        newName = `${prefix}${originalBase}${suffix}${ext}`;
      } else {
        // number mode (default)
        const num = String(counter).padStart(pad, "0");
        newName = `${baseName}_${num}${ext}`;
        counter++;
      }

      // avoid weird names
      newName = newName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

      // just add original PDF bytes with new name
      const bytes = await fsp.readFile(file.path);
      archive.append(Buffer.from(bytes), { name: newName });

      await safeUnlink(file.path);
    }

    await archive.finalize();
  } catch (err) {
    console.error("Bulk rename error:", err);
    for (const f of files) await safeUnlink(f.path);
    await safeUnlink(zipPath);
    if (!res.headersSent) res.status(500).send("Bulk rename failed");
  }
});

export default router;
