import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
const convertedDir = path.join(process.cwd(), "converted");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB total per file
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new Error("Only PDF files allowed"));
    cb(null, true);
  },
});

async function safeUnlink(p) {
  try {
    await fsp.unlink(p);
  } catch {}
}

// POST /bulk-watermark-pdf
// form-data:
//  - pdfs: multiple PDFs
//  - text: watermark text (default CONFIDENTIAL)
//  - opacity: 0.05..0.6 (default 0.2)
router.post("/", upload.array("pdfs"), async (req, res) => {
  const files = req.files || [];
  const text = String(req.body.text || "CONFIDENTIAL").trim() || "CONFIDENTIAL";

  // clamp opacity
  let opacity = Number(req.body.opacity ?? 0.2);
  if (Number.isNaN(opacity)) opacity = 0.2;
  opacity = Math.min(0.6, Math.max(0.05, opacity));

  if (!files.length) {
    return res.status(400).send("No PDFs uploaded");
  }

  const zipName = `bulk_watermark_${Date.now()}.zip`;
  const zipPath = path.join(convertedDir, zipName);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  // ✅ Prevent "Unhandled 'error' event" crashes
  archive.on("error", async (err) => {
    console.error("Bulk watermark archiver error:", err);
    try {
      archive.abort();
    } catch {}
    for (const f of files) await safeUnlink(f.path);
    await safeUnlink(zipPath);
    if (!res.headersSent) res.status(500).send("Bulk watermark failed (zip error)");
  });

  output.on("error", async (err) => {
    console.error("Bulk watermark output stream error:", err);
    for (const f of files) await safeUnlink(f.path);
    await safeUnlink(zipPath);
    if (!res.headersSent) res.status(500).send("Bulk watermark failed (write error)");
  });

  output.on("close", async () => {
    // Download ZIP, then delete it after response finishes
    res.download(zipPath, zipName, async () => {
      await safeUnlink(zipPath);
    });
  });

  archive.pipe(output);

  try {
    for (const file of files) {
      const inputBytes = await fsp.readFile(file.path);

      // ignoreEncryption: true prevents crash on encrypted PDFs (will still fail if truly locked)
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });

      // Use embedded font for consistent rendering
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();

        // diagonal watermark
        page.drawText(text, {
          x: width * 0.15,
          y: height * 0.5,
          size: Math.max(28, Math.min(52, width / 12)),
          font,
          rotate: degrees(45),
          color: rgb(0.6, 0.6, 0.6),
          opacity,
        });
      }

      const outBytes = await pdfDoc.save();

      // keep original name, add suffix
      const original = file.originalname || "file.pdf";
      const base = original.toLowerCase().endsWith(".pdf")
        ? original.slice(0, -4)
        : original;
      const outName = `${base}_watermarked.pdf`;

      // ✅ FIX: archiver requires Buffer or Stream (pdf-lib returns Uint8Array)
      archive.append(Buffer.from(outBytes), { name: outName });

      await safeUnlink(file.path);
    }

    await archive.finalize();
  } catch (err) {
    console.error("Bulk watermark error:", err);
    for (const f of files) await safeUnlink(f.path);
    await safeUnlink(zipPath);
    if (!res.headersSent) res.status(500).send("Bulk watermark failed");
  }
});

export default router;
