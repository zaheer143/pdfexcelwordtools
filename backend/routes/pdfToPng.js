import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Poppler from "pdf-poppler";
import archiver from "archiver";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads");
const outputDir = path.join(__dirname, "..", "converted");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename(req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
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
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const pdfPath = req.file.path;
    const baseName = path.parse(pdfPath).name;

    const options = {
      format: "png",
      out_dir: outputDir,
      out_prefix: baseName,
      page: null,
    };

    await Poppler.convert(pdfPath, options);

    const zipPath = path.join(outputDir, baseName + ".zip");
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip");

    archive.pipe(output);

    const images = fs
      .readdirSync(outputDir)
      .filter(f => f.startsWith(baseName) && f.endsWith(".png"));

    images.forEach(img => {
      archive.file(path.join(outputDir, img), { name: img });
    });

    await archive.finalize();

    output.on("close", () => {
      res.download(zipPath, baseName + "_png.zip", () => {
        fs.unlinkSync(pdfPath);
        fs.unlinkSync(zipPath);
        images.forEach(img =>
          fs.unlinkSync(path.join(outputDir, img))
        );
      });
    });

  } catch (err) {
    console.error("PDF → PNG error:", err);
    res.status(500).json({ error: "Conversion failed" });
  }
});

export default router;
