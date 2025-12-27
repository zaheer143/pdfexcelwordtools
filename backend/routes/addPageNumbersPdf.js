import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const position = (req.body.position || "bottom-center").toLowerCase();
  const startAt = parseInt(req.body.startAt || "1", 10);
  const fontSize = clamp(parseInt(req.body.fontSize || "12", 10), 8, 48);

  const inputPath = req.file.path;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputFolder, `${baseName}-page-numbers.pdf`);

  try {
    const bytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const total = pages.length;

    const margin = 18; // safe margin
    const yTop = (h) => h - margin - fontSize;
    const yBottom = () => margin;

    const getXY = (w, h, textWidth) => {
      // X
      let x = (w - textWidth) / 2;
      if (position.includes("left")) x = margin;
      if (position.includes("right")) x = w - margin - textWidth;

      // Y
      let y = yBottom();
      if (position.startsWith("top")) y = yTop(h);

      return { x, y };
    };

    for (let i = 0; i < total; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      const number = (Number.isFinite(startAt) ? startAt : 1) + i;
      const label = `${number} / ${total}`; // classic iLovePDF style

      const textWidth = font.widthOfTextAtSize(label, fontSize);
      const { x, y } = getXY(width, height, textWidth);

      page.drawText(label, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.25, 0.25, 0.25),
        opacity: 0.9,
      });
    }

    const outBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, outBytes);

    fs.unlink(inputPath, () => {});
    res.download(outputPath, `${baseName}-page-numbers.pdf`, (err) => {
      fs.unlink(outputPath, () => {});
      if (err) console.error("Add Page Numbers send error:", err);
    });
  } catch (err) {
    console.error("Add Page Numbers error:", err);
    fs.unlink(inputPath, () => {});
    return res.status(500).json({ error: err.message || "Failed to add page numbers" });
  }
});

export default router;
