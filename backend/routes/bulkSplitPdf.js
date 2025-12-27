import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import unzipper from "unzipper";
import { PDFDocument } from "pdf-lib";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
const convertedDir = path.join(process.cwd(), "converted");

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(convertedDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 300 * 1024 * 1024 },
});

async function cleanup(...targets) {
  for (const t of targets) {
    try {
      await fsp.rm(t, { recursive: true, force: true });
    } catch {}
  }
}

function safeFolderName(name) {
  return String(name || "pdf").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "pdf";
}

function buildRanges(everyN, total) {
  const n = Math.max(1, parseInt(everyN, 10) || 1);
  const ranges = [];
  for (let i = 1; i <= total; i += n) {
    ranges.push([i, Math.min(i + n - 1, total)]);
  }
  return ranges;
}

async function splitPdfBufferToZip({ buffer, folderName, everyN, archive }) {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const total = src.getPageCount();
  const ranges = buildRanges(everyN, total);

  let idx = 1;
  for (const [a, b] of ranges) {
    const out = await PDFDocument.create();
    const indices = Array.from({ length: b - a + 1 }, (_, i) => (a - 1) + i);
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));

    const bytes = await out.save();
    const part = String(idx).padStart(3, "0");

    archive.append(Buffer.from(bytes), {
      name: `${folderName}/${folderName}_part_${part}_p${a}-p${b}.pdf`,
    });

    idx++;
  }
}

async function findPdfFilesRecursive(dir) {
  const out = [];

  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else {
        const lower = ent.name.toLowerCase().trim();
        if (lower.endsWith(".pdf")) out.push(full);
      }
    }
  }

  await walk(dir);
  return out;
}

// POST /bulk-split-pdf
// form-data:
// - file (preferred) OR pdf (legacy): PDF or ZIP
// - everyN: pages per part
router.post(
  "/",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    const uploaded = req.files?.file?.[0] || req.files?.pdf?.[0];
    if (!uploaded) return res.status(400).send("No file uploaded");

    const everyN = req.body.everyN || 5;
    const inputPath = uploaded.path;
    const originalLower = (uploaded.originalname || "").toLowerCase().trim();

    const zipName = `bulk_split_${Date.now()}.zip`;
    const zipPath = path.join(convertedDir, zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", async (err) => {
      console.error("Bulk split archiver error:", err);
      try { archive.abort(); } catch {}
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Bulk split failed (zip error)");
    });

    output.on("error", async (err) => {
      console.error("Bulk split output error:", err);
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Bulk split failed (write error)");
    });

    output.on("close", async () => {
      res.download(zipPath, zipName, async () => {
        await cleanup(zipPath);
      });
    });

    archive.pipe(output);

    try {
      let processed = 0;

      if (originalLower.endsWith(".pdf")) {
        const buf = await fsp.readFile(inputPath);
        const base = safeFolderName(path.parse(uploaded.originalname).name);
        await splitPdfBufferToZip({ buffer: buf, folderName: base, everyN, archive });
        processed = 1;
      } else if (originalLower.endsWith(".zip")) {
        const unzipDir = inputPath + "_unzipped";
        fs.mkdirSync(unzipDir, { recursive: true });

        await fs
          .createReadStream(inputPath)
          .pipe(unzipper.Extract({ path: unzipDir }))
          .promise();

        const pdfPaths = await findPdfFilesRecursive(unzipDir);

        if (pdfPaths.length === 0) {
          await cleanup(unzipDir, inputPath, zipPath);
          return res.status(400).send("No PDFs found inside the ZIP. Please upload a ZIP that contains .pdf files.");
        }

        for (const pdfPath of pdfPaths) {
          const buf = await fsp.readFile(pdfPath);
          const base = safeFolderName(path.parse(pdfPath).name);
          await splitPdfBufferToZip({ buffer: buf, folderName: base, everyN, archive });
          processed++;
        }

        await cleanup(unzipDir);
      } else {
        await cleanup(inputPath, zipPath);
        return res.status(400).send("Only PDF or ZIP supported");
      }

      await cleanup(inputPath);

      if (processed === 0) {
        await cleanup(zipPath);
        return res.status(400).send("Nothing to split. ZIP had no valid PDFs.");
      }

      await archive.finalize();
    } catch (err) {
      console.error("Bulk split error:", err);
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Bulk split failed");
    }
  }
);

export default router;
