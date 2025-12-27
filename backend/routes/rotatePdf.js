import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, degrees } from "pdf-lib";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// folders
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

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  // angle comes from form field "angle" (90 / 180 / 270)
  const angle = parseInt(req.body.angle, 10) || 0;
  if (![90, 180, 270].includes(angle)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Invalid rotation angle" });
  }

  const inputPath = req.file.path;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputFolder, `${baseName}-rotated.pdf`);

  try {
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    const rotation = degrees(angle);

    pages.forEach((page) => {
      // rotate relative to current rotation
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees((current + angle) % 360));
      // alternative: page.setRotation(rotation); to force
    });

    const outBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, outBytes);

    // clean input file
    fs.unlink(inputPath, () => {});

    const downloadName = `${baseName}-rotated.pdf`;

    res.download(outputPath, downloadName, (err) => {
      fs.unlink(outputPath, () => {});
      if (err) {
        console.error("Rotate PDF send error:", err);
      }
    });
  } catch (err) {
    console.error("Rotate PDF error:", err);
    fs.unlink(inputPath, () => {});
    return res
      .status(500)
      .json({ error: err.message || "Failed to rotate PDF" });
  }
});

export default router;
