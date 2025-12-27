import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import unzipper from "unzipper";
import archiver from "archiver";
import crypto from "crypto";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads");
const workDirBase = path.join(__dirname, "..", "work");
const outDir = path.join(__dirname, "..", "converted");

for (const d of [uploadDir, workDirBase, outDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || ".zip");
    const base = path.basename(file.originalname || "bulk", ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB zip
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      (file.originalname || "").toLowerCase().endsWith(".zip");
    if (!ok) return cb(new Error("Only .zip files allowed"));
    cb(null, true);
  },
});

function safeGsBin() {
  if (process.env.GHOSTSCRIPT_BIN && process.env.GHOSTSCRIPT_BIN.trim()) {
    return process.env.GHOSTSCRIPT_BIN.trim();
  }
  return process.platform === "win32" ? "gswin64c" : "gs";
}

async function safeRm(p) {
  try {
    await fsp.rm(p, { recursive: true, force: true });
  } catch {}
}

function compressPdf(inputPath, outputPath, pdfSettings) {
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

    const child = spawn(safeGsBin(), args, { windowsHide: true });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => resolve({ ok: false, stderr: err.message }));
    child.on("close", (code) =>
      resolve({ ok: code === 0 && fs.existsSync(outputPath), stderr })
    );
  });
}

async function unzipToDir(zipPath, destDir) {
  await fsp.mkdir(destDir, { recursive: true });
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: destDir }))
      .on("close", resolve)
      .on("error", reject);
  });
}

async function findPdfFiles(dir) {
  const results = [];
  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results;
}

function zipFolder(folderPath, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });
}

// POST /bulk-compress
// form-data: zip (file), level = light|recommended|strong
router.post("/", upload.single("zip"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No ZIP uploaded" });

  const level = (req.body.level || "recommended").toString();
  const map = {
    light: "/printer",
    recommended: "/ebook",
    strong: "/screen",
  };
  const pdfSettings = map[level] || "/ebook";

  const jobId = crypto.randomBytes(8).toString("hex");
  const workDir = path.join(workDirBase, `bulk_${jobId}`);
  const extractedDir = path.join(workDir, "in");
  const processedDir = path.join(workDir, "out");

  const zipInputPath = req.file.path;
  const outZipPath = path.join(outDir, `bulk_compressed_${jobId}.zip`);

  try {
    await fsp.mkdir(processedDir, { recursive: true });

    // 1) unzip
    await unzipToDir(zipInputPath, extractedDir);

    // 2) find pdfs
    const pdfs = await findPdfFiles(extractedDir);
    if (pdfs.length === 0) {
      await safeRm(workDir);
      await safeRm(zipInputPath);
      return res.status(400).json({ error: "ZIP has no PDF files" });
    }

    // Optional: limit for safety (you can make paid later)
    const MAX_FILES = Number(process.env.BULK_MAX_FILES || 50);
    const toProcess = pdfs.slice(0, MAX_FILES);

    // 3) process sequentially (safe)
    const results = [];
    for (const inputPdf of toProcess) {
      const name = path.basename(inputPdf);
      const outPdf = path.join(processedDir, name.replace(/\.pdf$/i, "") + "_compressed.pdf");

      const r = await compressPdf(inputPdf, outPdf, pdfSettings);
      if (r.ok) {
        results.push({ file: name, ok: true });
      } else {
        // keep going, but log failure
        results.push({ file: name, ok: false, err: (r.stderr || "").slice(0, 200) });
      }
    }

    // 4) zip outputs
    await zipFolder(processedDir, outZipPath);

    // cleanup input zip + work folder
    await safeRm(zipInputPath);
    await safeRm(workDir);

    // 5) send zip
    res.setHeader("X-Bulk-Processed", String(toProcess.length));
    res.setHeader("X-Bulk-Level", level);

    return res.download(outZipPath, `bulk_compressed_${level}.zip`, async () => {
      await safeRm(outZipPath);
    });
  } catch (e) {
    console.error("Bulk compress error:", e);
    await safeRm(zipInputPath);
    await safeRm(workDir);
    await safeRm(outZipPath);
    return res.status(500).json({ error: "Bulk compress failed", details: e.message });
  }
});

export default router;
