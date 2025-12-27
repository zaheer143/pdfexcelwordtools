import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

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
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files allowed"));
    }
    cb(null, true);
  },
});

// helper to parse hex color to pdf-lib rgb
function hexToRgb01(hex) {
  if (!hex) return rgb(0.85, 0.1, 0.1); // default reddish
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return rgb(0.85, 0.1, 0.1);
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  const text = (req.body.text || "").trim();
  if (!text) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Watermark text is required" });
  }

  const style = req.body.style === "diagonal" ? "diagonal" : "center";
  const fontSize = Number(req.body.fontSize) || 48;
  let opacity = Number(req.body.opacity);
  if (Number.isNaN(opacity) || opacity <= 0 || opacity > 1) {
    opacity = 0.15; // default 15% opacity
  }
  const color = hexToRgb01(req.body.color || "#FF2E88"); // pinkish default

  const inputPath = req.file.path;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputFolder, `${baseName}-watermarked.pdf`);

  try {
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();

    pages.forEach((page) => {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      const x = (width - textWidth) / 2;
      const y = (height - textHeight) / 2;

      const options = {
        x,
        y,
        size: fontSize,
        font,
        color,
        opacity,
      };

      if (style === "diagonal") {
        options.rotate = degrees(45);
      }

      page.drawText(text, options);
    });

    const outBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, outBytes);

    // cleanup input
    fs.unlink(inputPath, () => {});

    const downloadName = `${baseName}-watermarked.pdf`;
    res.download(outputPath, downloadName, (err) => {
      fs.unlink(outputPath, () => {});
      if (err) {
        console.error("Watermark PDF send error:", err);
      }
    });
  } catch (err) {
    console.error("Watermark PDF error:", err);
    fs.unlink(inputPath, () => {});
    return res
      .status(500)
      .json({ error: err.message || "Failed to apply watermark" });
  }
});

export default router;
