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
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF files allowed"));
    cb(null, true);
  },
});

// Parse "1,3-5,9" -> Set of zero-based indices to remove
function parseRanges(input, pageCount) {
  const s = String(input || "").trim();
  if (!s) return new Set();

  const remove = new Set();
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [aRaw, bRaw] = part.split("-").map(x => x.trim());
      const a = parseInt(aRaw, 10);
      const b = parseInt(bRaw, 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const start = Math.max(1, Math.min(a, b));
      const end = Math.min(pageCount, Math.max(a, b));
      for (let i = start; i <= end; i++) remove.add(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (!Number.isFinite(n)) continue;
      if (n >= 1 && n <= pageCount) remove.add(n - 1);
    }
  }
  return remove;
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const pagesStr = (req.body.pages || "").trim(); // example: "1,3-5"
  const inputPath = req.file.path;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputFolder, `${baseName}-removed-pages.pdf`);

  try {
    const bytes = fs.readFileSync(inputPath);
    const src = await PDFDocument.load(bytes);
    const pageCount = src.getPageCount();

    const removeSet = parseRanges(pagesStr, pageCount);

    // Keep pages not in removeSet
    const keep = [];
    for (let i = 0; i < pageCount; i++) {
      if (!removeSet.has(i)) keep.push(i);
    }

    if (keep.length === 0) {
      fs.unlink(inputPath, () => {});
      return res.status(400).json({ error: "You removed all pages. Keep at least 1 page." });
    }

    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, keep);
    copied.forEach(p => out.addPage(p));

    const outBytes = await out.save();
    fs.writeFileSync(outputPath, outBytes);

    fs.unlink(inputPath, () => {});
    res.download(outputPath, `${baseName}-removed-pages.pdf`, (err) => {
      fs.unlink(outputPath, () => {});
      if (err) console.error("Remove Pages send error:", err);
    });
  } catch (err) {
    console.error("Remove Pages error:", err);
    fs.unlink(inputPath, () => {});
    return res.status(500).json({ error: err.message || "Failed to remove pages" });
  }
});

export default router;
