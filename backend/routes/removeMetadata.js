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
const outDir = path.join(__dirname, "..", "converted");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF allowed"));
    cb(null, true);
  },
});

function safeDel(p) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {} }
function gsBin() {
  if (process.env.GHOSTSCRIPT_BIN && process.env.GHOSTSCRIPT_BIN.trim()) return process.env.GHOSTSCRIPT_BIN.trim();
  return process.platform === "win32" ? "gswin64c" : "gs";
}

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const input = req.file.path;
  const base = path.basename(req.file.originalname, ".pdf");
  const output = path.join(outDir, `${base}_sanitized_${Date.now()}.pdf`);

  // Ghostscript rewrite removes a lot of metadata (DocInfo/XMP usually dropped)
  // We keep it safe + consistent output
  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dNOPAUSE",
    "-dBATCH",
    "-dQUIET",

    // Safety: no file operations from PS/PDF
    "-dSAFER",

    // Output
    `-sOutputFile=${output}`,
    input,
  ];

  const child = spawn(gsBin(), args, { windowsHide: true });

  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));

  child.on("error", (err) => {
    safeDel(input);
    safeDel(output);
    return res.status(500).json({ error: "Ghostscript not found", details: err.message });
  });

  child.on("close", (code) => {
    safeDel(input);

    if (code !== 0 || !fs.existsSync(output)) {
      safeDel(output);
      return res.status(500).json({
        error: "Sanitize failed",
        details: stderr.slice(0, 900),
      });
    }

    res.download(output, `${base}_sanitized.pdf`, () => safeDel(output));
  });
});

export default router;
