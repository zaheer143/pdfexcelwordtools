import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import archiver from "archiver"; // optional, safe to keep

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadFolder = path.join(__dirname, "..", "uploads");
const outputFolder = path.join(__dirname, "..", "converted");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });
if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, uploadFolder); },
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

function detectGsBinary() {
  if (process.env.GHOSTSCRIPT_BIN && process.env.GHOSTSCRIPT_BIN.trim()) {
    return process.env.GHOSTSCRIPT_BIN.trim();
  }
  return process.platform === "win32" ? "gswin64c" : "gs";
}

// Flatten = re-render PDF to new PDF (removes form fields & edits)
// We'll use Ghostscript pdfwrite
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const inputPath = req.file.path;
  const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const outPath = path.join(outputFolder, `${baseName}_flattened_${Date.now()}.pdf`);

  const gs = detectGsBinary();

  // Extra safety + output consistency
  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dNOPAUSE",
    "-dBATCH",
    "-dQUIET",
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    `-sOutputFile=${outPath}`,
    inputPath,
  ];

  try {
    const child = spawn(gs, args, { windowsHide: true });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      console.error("Flatten spawn error:", err);
      safeUnlink(inputPath);
      safeUnlink(outPath);
      return res.status(500).json({ error: "Ghostscript not found", details: err.message });
    });

    child.on("close", (code) => {
      safeUnlink(inputPath);

      if (code !== 0 || !fs.existsSync(outPath)) {
        console.error("Flatten failed:", stderr || `exit ${code}`);
        safeUnlink(outPath);
        return res.status(500).json({
          error: "Flatten failed",
          details: (stderr || "").slice(0, 800),
        });
      }

      res.download(outPath, `${baseName}_flattened.pdf`, () => {
        safeUnlink(outPath);
      });
    });
  } catch (err) {
    console.error("Flatten route error:", err);
    safeUnlink(inputPath);
    safeUnlink(outPath);
    return res.status(500).json({ error: "Flatten failed" });
  }
});

export default router;
