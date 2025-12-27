import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

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
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF allowed"));
    cb(null, true);
  },
});

function gsBin() {
  if (process.env.GHOSTSCRIPT_BIN) return process.env.GHOSTSCRIPT_BIN;
  return process.platform === "win32" ? "gswin64c" : "gs";
}

function safeDel(p) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const input = req.file.path;
  const base = path.basename(req.file.originalname, ".pdf");
  const output = path.join(outputDir, `${base}_PDFA_${Date.now()}.pdf`);

  const args = [
    "-dPDFA=1",
    "-dBATCH",
    "-dNOPAUSE",
    "-dNOOUTERSAVE",
    "-sProcessColorModel=DeviceRGB",
    "-sDEVICE=pdfwrite",
    "-dPDFACompatibilityPolicy=1",
    `-sOutputFile=${output}`,
    input,
  ];

  const child = spawn(gsBin(), args, { windowsHide: true });

  let stderr = "";
  child.stderr.on("data", d => stderr += d.toString());

  child.on("error", err => {
    safeDel(input);
    safeDel(output);
    return res.status(500).json({
      error: "Ghostscript not found",
      details: err.message,
    });
  });

  child.on("close", code => {
    safeDel(input);

    if (code !== 0 || !fs.existsSync(output)) {
      safeDel(output);
      return res.status(500).json({
        error: "PDF/A conversion failed",
        details: stderr.slice(0, 800),
      });
    }

    res.download(output, `${base}_PDFA.pdf`, () => safeDel(output));
  });
});

export default router;
