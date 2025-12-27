import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// folders
const uploadFolder = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

// multer
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
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
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

  const inputPath = req.file.path;
  const originalName = path.basename(
    req.file.originalname,
    path.extname(req.file.originalname)
  );

  try {
    // ✅ pdfjs-dist for Node (no worker)
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const buffer = fs.readFileSync(inputPath);
    const uint8 = new Uint8Array(buffer); // 🔥 FIX

    const loadingTask = pdfjs.getDocument({
      data: uint8,
      disableWorker: true,
    });

    const pdf = await loadingTask.promise;

    let extractedText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item) => item.str || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (pageText) {
        extractedText += pageText + "\n\n";
      }
    }

    extractedText = extractedText.trim();

    if (!extractedText) {
      fs.unlinkSync(inputPath);
      return res.status(400).json({
        error:
          "No text found. This PDF is likely scanned (image-based). OCR is required.",
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalName}_text.txt"`
    );

    res.send(extractedText);
    fs.unlinkSync(inputPath);
  } catch (err) {
    console.error("PDF → TXT error:", err);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});

export default router;
