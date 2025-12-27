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
  limits: { fileSize: 80 * 1024 * 1024 }, // 80MB
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF files allowed"));
    cb(null, true);
  },
});

// Map your modes to Ghostscript presets
function mapMode(mode) {
  const m = (mode || "recommended").toLowerCase();
  if (m === "extreme") return "/screen";       // smallest, lowest quality
  if (m === "low") return "/printer";          // light compression, best quality
  return "/ebook";                              // recommended balance
}

function detectGsBinary() {
  // Prefer explicit env var
  if (process.env.GHOSTSCRIPT_BIN && process.env.GHOSTSCRIPT_BIN.trim()) {
    return process.env.GHOSTSCRIPT_BIN.trim();
  }
  // Common names:
  // Linux: gs
  // Windows: gswin64c.exe / gswin32c.exe
  return process.platform === "win32" ? "gswin64c" : "gs";
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const inputPath = req.file.path;
  const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const outputPath = path.join(outputFolder, `${baseName}_compressed.pdf`);

  const mode = (req.body.mode || "recommended").toString();
  const preset = mapMode(mode);

  const gs = detectGsBinary();

  // Ghostscript args: safe + standard PDF output
  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=${preset}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];

  try {
    const child = spawn(gs, args, { windowsHide: true });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      console.error("Ghostscript spawn error:", err);
    });

    child.on("close", (code) => {
      // cleanup uploaded file
      try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}

      if (code !== 0 || !fs.existsSync(outputPath)) {
        console.error("Ghostscript failed:", stderr || `exit code ${code}`);
        return res.status(500).json({
          error:
            "Compression failed. Ghostscript is missing or crashed. " +
            "Install Ghostscript / set GHOSTSCRIPT_BIN.",
          details: stderr?.slice(0, 500),
        });
      }

      return res.download(outputPath, `${baseName}_compressed.pdf`, () => {
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
      });
    });
  } catch (err) {
    console.error("Compress PDF error:", err);
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}
    res.status(500).json({ error: "Failed to compress PDF" });
  }
});

export default router;
