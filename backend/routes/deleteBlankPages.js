import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadFolder = path.join(__dirname, "..", "uploads");
const outputFolder = path.join(__dirname, "..", "converted");

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });
if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadFolder);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF files allowed"));
    cb(null, true);
  },
});

/**
 * Text-based "blank" detection:
 * - Looks for any text drawing operators in the page content stream.
 * - If none found, we treat it as blank.
 *
 * Notes:
 * - Works great for normal PDFs (digital text).
 * - Scanned-image pages will NOT be removed (they contain images, not text).
 */
function pageHasTextOperators(page) {
  try {
    // pdf-lib internal structure access (works reliably for this use)
    const node = page.node;
    const contents = node.Contents();

    if (!contents) return false;

    // Contents can be a single stream or an array of streams
    const streams = Array.isArray(contents) ? contents : [contents];

    let combined = "";
    for (const s of streams) {
      const stream = s.lookup ? s.lookup(node.context) : s;
      if (!stream || !stream.getContents) continue;
      const bytes = stream.getContents();
      combined += Buffer.from(bytes).toString("latin1") + "\n";
    }

    // Common PDF text operators: Tj, TJ, ', ", BT/ET blocks
    // If we find these, page likely has text.
    return (
      combined.includes(" Tj") ||
      combined.includes(" TJ") ||
      combined.includes("\nTj") ||
      combined.includes("\nTJ") ||
      combined.includes(" BT") ||
      combined.includes(" ET") ||
      combined.includes(" '") ||
      combined.includes(' "')
    );
  } catch {
    return true; // fail-safe: keep the page if unsure
  }
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const inputPath = req.file.path;
  const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const outputPath = path.join(outputFolder, `${baseName}_no_blank.pdf`);

  try {
    const bytes = fs.readFileSync(inputPath);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const total = src.getPageCount();
    if (total === 0) {
      fs.unlinkSync(inputPath);
      return res.status(400).json({ error: "PDF has no pages" });
    }

    // Decide which pages to keep
    const keepIndices = [];
    const pages = src.getPages();

    for (let i = 0; i < pages.length; i++) {
      const hasText = pageHasTextOperators(pages[i]);
      if (hasText) keepIndices.push(i);
    }

    // If all pages detected blank, keep at least 1 (fail-safe)
    if (keepIndices.length === 0) keepIndices.push(0);

    // Create output PDF
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, keepIndices);
    copied.forEach((p) => out.addPage(p));

    fs.writeFileSync(outputPath, await out.save());

    // cleanup input
    fs.unlinkSync(inputPath);

    res.download(outputPath, `${baseName}_no_blank.pdf`, () => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  } catch (err) {
    console.error("Delete Blank Pages error:", err);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(500).json({ error: "Failed to delete blank pages" });
  }
});

export default router;
