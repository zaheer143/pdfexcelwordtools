import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
const convertedDir = path.join(process.cwd(), "converted");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
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

// POST /bulk-merge-pdf
router.post("/", upload.array("pdfs"), async (req, res) => {
  const files = req.files || [];
  if (files.length < 2) {
    return res.status(400).send("Upload at least 2 PDFs to merge");
  }

  try {
    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const bytes = await fsp.readFile(file.path);
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => mergedPdf.addPage(p));
      await safeUnlink(file.path);
    }

    const outBytes = await mergedPdf.save();
    const outName = `merged_${Date.now()}.pdf`;
    const outPath = path.join(convertedDir, outName);

    await fsp.writeFile(outPath, Buffer.from(outBytes));

    res.download(outPath, outName, async () => {
      await safeUnlink(outPath);
    });
  } catch (err) {
    console.error("Bulk merge error:", err);
    for (const f of files) await safeUnlink(f.path);
    res.status(500).send("Bulk merge failed");
  }
});

export default router;
