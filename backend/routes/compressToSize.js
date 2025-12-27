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

function runGs(inputPath, outputPath, pdfSettings) {
  return new Promise((resolve) => {
    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${pdfSettings}`, // /screen /ebook /printer /prepress
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      "-dDetectDuplicateImages=true",
      "-dCompressFonts=true",
      "-dSubsetFonts=true",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    const child = spawn(gsBin(), args, { windowsHide: true });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => resolve({ ok: false, stderr: err.message }));
    child.on("close", (code) => resolve({ ok: code === 0 && fs.existsSync(outputPath), stderr }));
  });
}

// Try multiple levels until under target (best-effort)
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const input = req.file.path;
  const base = path.basename(req.file.originalname, ".pdf");

  // targetKb example: 200, 500, 1024
  const targetKb = Math.max(50, Number(req.body.targetKb || 500));
  const targetBytes = targetKb * 1024;

  // order from best quality → strongest compression
  const levels = ["/printer", "/ebook", "/screen"];
  const attempts = [];

  try {
    let bestPath = null;
    let bestSize = Infinity;

    for (let i = 0; i < levels.length; i++) {
      const outPath = path.join(outDir, `${base}_target_${targetKb}kb_${i}_${Date.now()}.pdf`);

      const r = await runGs(input, outPath, levels[i]);
      if (!r.ok) {
        attempts.push({ level: levels[i], ok: false, err: (r.stderr || "").slice(0, 300) });
        safeDel(outPath);
        continue;
      }

      const size = fs.statSync(outPath).size;
      attempts.push({ level: levels[i], ok: true, size });

      // Keep best (smallest)
      if (size < bestSize) {
        if (bestPath) safeDel(bestPath);
        bestPath = outPath;
        bestSize = size;
      } else {
        safeDel(outPath);
      }

      // If under target, stop early (good!)
      if (size <= targetBytes) break;
    }

    safeDel(input);

    if (!bestPath) {
      return res.status(500).json({ error: "Compression failed", attempts });
    }

    // If still not under target, we still return the smallest file (best-effort)
    res.setHeader("X-Target-KB", String(targetKb));
    res.setHeader("X-Output-KB", String(Math.round(bestSize / 1024)));

    return res.download(bestPath, `${base}_compressed_${targetKb}kb.pdf`, () => {
      safeDel(bestPath);
    });
  } catch (e) {
    safeDel(input);
    return res.status(500).json({ error: "Compression failed", details: e.message });
  }
});

export default router;
