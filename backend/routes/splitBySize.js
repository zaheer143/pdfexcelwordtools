import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads");
const outDir = path.join(__dirname, "..", "converted");
const workBase = path.join(__dirname, "..", "work");

for (const d of [uploadDir, outDir, workBase]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || ".pdf");
    const base = path.basename(file.originalname || "file", ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new Error("Only PDF allowed"));
    cb(null, true);
  },
});

async function safeRm(p) {
  try {
    await fsp.rm(p, { recursive: true, force: true });
  } catch {}
}

function zipFolder(folderPath, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });
}

// POST /split-by-size
// form-data: file (pdf), size (number), unit ("KB"|"MB")
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const sizeRaw = Number(req.body.size || 0);
  const unit = String(req.body.unit || "MB").toUpperCase();

  if (!sizeRaw || sizeRaw <= 0) {
    await safeRm(req.file.path);
    return res.status(400).json({ error: "Invalid size" });
  }

  const targetBytes =
    unit === "KB" ? Math.floor(sizeRaw * 1024) : Math.floor(sizeRaw * 1024 * 1024);

  // Safety minimum (too small makes many files)
  const MIN_BYTES = 40 * 1024; // 40KB
  const maxTargetBytes = Math.max(targetBytes, MIN_BYTES);

  const jobId = crypto.randomBytes(8).toString("hex");
  const workDir = path.join(workBase, `split_${jobId}`);
  const outPartsDir = path.join(workDir, "parts");
  await fsp.mkdir(outPartsDir, { recursive: true });

  const originalName = path.basename(req.file.originalname || "document.pdf", ".pdf");
  const zipPath = path.join(outDir, `${originalName}_split_${jobId}.zip`);

  try {
    const inputBytes = await fsp.readFile(req.file.path);
    const srcPdf = await PDFDocument.load(inputBytes, { ignoreEncryption: true });

    const totalPages = srcPdf.getPageCount();
    if (totalPages === 0) throw new Error("PDF has no pages");

    // Limit to avoid abuse (you can increase for paid)
    const MAX_PAGES = Number(process.env.SPLIT_MAX_PAGES || 500);
    const MAX_PARTS = Number(process.env.SPLIT_MAX_PARTS || 200);
    if (totalPages > MAX_PAGES) throw new Error(`Too many pages (max ${MAX_PAGES})`);

    const parts = [];
    let current = []; // page indices
    let partNo = 1;

    const writePart = async (indices) => {
      const doc = await PDFDocument.create();
      const copied = await doc.copyPages(srcPdf, indices);
      copied.forEach((p) => doc.addPage(p));
      const bytes = await doc.save();
      const partPath = path.join(outPartsDir, `${originalName}_part_${String(partNo).padStart(3, "0")}.pdf`);
      await fsp.writeFile(partPath, bytes);
      parts.push(partPath);
      partNo++;
      return bytes.length;
    };

    // Build parts by adding pages until size exceeds target
    for (let i = 0; i < totalPages; i++) {
      current.push(i);

      // Estimate size by creating a temporary PDF for current pages
      const tempDoc = await PDFDocument.create();
      const tempPages = await tempDoc.copyPages(srcPdf, current);
      tempPages.forEach((p) => tempDoc.addPage(p));
      const tempBytes = await tempDoc.save();
      const tempSize = tempBytes.length;

      // If we exceeded target and we have more than 1 page, finalize previous chunk
      if (tempSize > maxTargetBytes && current.length > 1) {
        const last = current.pop(); // remove the page that pushed it over
        await writePart(current);   // write previous pages
        current = [last];           // start new part with last page
      }

      if (parts.length >= MAX_PARTS) {
        throw new Error(`Too many parts (max ${MAX_PARTS}). Increase target size.`);
      }
    }

    // Write remaining pages
    if (current.length) {
      await writePart(current);
    }

    // zip parts
    await zipFolder(outPartsDir, zipPath);

    // cleanup
    await safeRm(req.file.path);
    await safeRm(workDir);

    return res.download(zipPath, `${originalName}_split_by_size.zip`, async () => {
      await safeRm(zipPath);
    });
  } catch (e) {
    console.error("Split-by-size error:", e);
    await safeRm(req.file.path);
    await safeRm(workDir);
    await safeRm(zipPath);
    return res.status(500).json({ error: "Split by size failed", details: e.message });
  }
});

export default router;
