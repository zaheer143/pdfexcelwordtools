import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

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
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF allowed"));
    cb(null, true);
  },
});

function hexToRgb01(hex) {
  const h = (hex || "#000000").replace("#", "").trim();
  const r = parseInt(h.slice(0, 2) || "00", 16) / 255;
  const g = parseInt(h.slice(2, 4) || "00", 16) / 255;
  const b = parseInt(h.slice(4, 6) || "00", 16) / 255;
  return { r, g, b };
}

// annotations: [{pageIndex, x, y, text, size, color, opacity, rotate, bold}]
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const inputPath = req.file.path;
  const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const outputPath = path.join(outputFolder, `${baseName}_typed.pdf`);

  try {
    const annotations = JSON.parse(req.body.annotations || "[]");
    if (!Array.isArray(annotations)) {
      fs.unlinkSync(inputPath);
      return res.status(400).json({ error: "Invalid annotations JSON" });
    }

    const pdfBytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const pages = doc.getPages();

    for (const a of annotations) {
      const pageIndex = Number(a.pageIndex);
      if (!Number.isFinite(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];

      const text = (a.text ?? "").toString();
      if (!text.trim()) continue;

      const size = Math.max(6, Math.min(200, Number(a.size ?? 16)));
      const opacity = Math.max(0.05, Math.min(1, Number(a.opacity ?? 1)));
      const rotate = Math.max(0, Math.min(360, Number(a.rotate ?? 0)));
      const bold = !!a.bold;

      const x = Number(a.x);
      const y = Number(a.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const { r, g, b } = hexToRgb01(a.color || "#111111");

      // Support multi-line: draw each line lower
      const lines = text.split("\n");
      const lineGap = size * 1.15;

      for (let i = 0; i < lines.length; i++) {
        page.drawText(lines[i], {
          x,
          y: y - i * lineGap,
          size,
          font: bold ? fontBold : fontRegular,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(rotate),
        });
      }
    }

    fs.writeFileSync(outputPath, await doc.save());
    fs.unlinkSync(inputPath);

    res.download(outputPath, `${baseName}_typed.pdf`, () => {
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    });
  } catch (err) {
    console.error("Type-on-PDF error:", err);
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}
    res.status(500).json({ error: "Failed to apply text overlays" });
  }
});

export default router;
