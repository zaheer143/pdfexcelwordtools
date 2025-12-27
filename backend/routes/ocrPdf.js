import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

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
  limits: { fileSize: 120 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF allowed"));
    cb(null, true);
  },
});

function safeUnlink(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const inputPath = req.file.path;
  const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const outPath = path.join(outputFolder, `${baseName}_searchable_${Date.now()}.pdf`);

  // Options
  const lang = (req.body.lang || "eng").toString().trim();         // example: eng, hin, tam, tel, kan, mal
  const optimize = (req.body.optimize || "1").toString().trim();   // 0..3 (higher = smaller, slower)
  const deskew = (req.body.deskew || "true").toString() === "true";
  const rotate = (req.body.rotate || "true").toString() === "true";

  // ocrmypdf command (installed in Railway container)
  // We use --skip-text so it won’t re-OCR digital PDFs unnecessarily
  const args = [
    "--skip-text",
    "--force-ocr",
    "-l", lang,
    "--optimize", optimize,
    "--output-type", "pdf",
  ];

  if (deskew) args.push("--deskew");
  if (rotate) args.push("--rotate-pages");

  // input / output
  args.push(inputPath, outPath);

  try {
    const cmd = process.env.OCRMYPDF_BIN?.trim() || "ocrmypdf";
    const child = spawn(cmd, args, { windowsHide: true });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      safeUnlink(inputPath);

      if (code !== 0 || !fs.existsSync(outPath)) {
        console.error("OCR failed:", stderr || `exit ${code}`);
        safeUnlink(outPath);
        return res.status(500).json({
          error: "OCR failed",
          details: (stderr || "").slice(0, 900),
        });
      }

      return res.download(outPath, `${baseName}_searchable.pdf`, () => {
        safeUnlink(outPath);
      });
    });
  } catch (err) {
    console.error("OCR route error:", err);
    safeUnlink(inputPath);
    safeUnlink(outPath);
    return res.status(500).json({ error: "OCR failed" });
  }
});

export default router;
