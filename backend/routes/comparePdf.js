import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import archiver from "archiver";
import sharp from "sharp";
import pdfPoppler from "pdf-poppler";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads");
const outDir = path.join(__dirname, "..", "converted");
const workBase = path.join(__dirname, "..", "work");

for (const d of [uploadDir, outDir, workBase]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || ".pdf");
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!(file.originalname || "").toLowerCase().endsWith(".pdf")) {
      return cb(new Error("Only PDF allowed"));
    }
    cb(null, true);
  },
});

async function safeRm(p) {
  try { await fsp.rm(p, { recursive: true, force: true }); } catch {}
}

async function pdfToPngs(pdfPath, outFolder) {
  await fsp.mkdir(outFolder, { recursive: true });

  const opts = {
    format: "png",
    out_dir: outFolder,
    out_prefix: "page",
    page: null,
    scale: 1500, // good quality (not too heavy)
  };

  await pdfPoppler.convert(pdfPath, opts);

  // returns list of png paths sorted
  const files = (await fsp.readdir(outFolder))
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => path.join(outFolder, f));

  return files;
}

// diff two images -> output overlay diff image + changed score
async function diffImages(imgA, imgB, outPath) {
  // Normalize size: resize B to A (or vice versa)
  const a = sharp(imgA);
  const metaA = await a.metadata();
  const w = metaA.width || 1000;
  const h = metaA.height || 1000;

  const bufA = await sharp(imgA).resize(w, h).ensureAlpha().raw().toBuffer();
  const bufB = await sharp(imgB).resize(w, h).ensureAlpha().raw().toBuffer();

  // Simple pixel diff: compute absolute difference and create heatmap-like output
  // We’ll create grayscale diff and threshold-ish highlight.
  const diff = Buffer.alloc(bufA.length);
  let changed = 0;

  for (let i = 0; i < bufA.length; i += 4) {
    const dr = Math.abs(bufA[i] - bufB[i]);
    const dg = Math.abs(bufA[i + 1] - bufB[i + 1]);
    const db = Math.abs(bufA[i + 2] - bufB[i + 2]);

    const d = Math.max(dr, dg, db); // 0..255
    if (d > 25) changed++; // pixel changed threshold

    // heatmap: red channel only
    diff[i] = d;           // R
    diff[i + 1] = 0;       // G
    diff[i + 2] = 0;       // B
    diff[i + 3] = 255;     // A
  }

  const changeRatio = changed / (w * h);

  // Overlay diff on top of A
  const diffPng = await sharp(diff, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();

  await sharp(imgA)
    .resize(w, h)
    .composite([{ input: diffPng, blend: "screen", opacity: 0.65 }])
    .png()
    .toFile(outPath);

  return { changeRatio };
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

// POST /compare-pdf  (multipart form-data)
// fields: a (pdf), b (pdf)
router.post("/", upload.fields([{ name: "a", maxCount: 1 }, { name: "b", maxCount: 1 }]), async (req, res) => {
  const fileA = req.files?.a?.[0];
  const fileB = req.files?.b?.[0];

  if (!fileA || !fileB) {
    if (fileA?.path) await safeRm(fileA.path);
    if (fileB?.path) await safeRm(fileB.path);
    return res.status(400).json({ error: "Upload both PDFs (a and b)" });
  }

  const job = crypto.randomBytes(8).toString("hex");
  const work = path.join(workBase, `compare_${job}`);
  const aDir = path.join(work, "a");
  const bDir = path.join(work, "b");
  const diffDir = path.join(work, "diff");
  await fsp.mkdir(diffDir, { recursive: true });

  const zipOut = path.join(outDir, `pdf_compare_${job}.zip`);

  try {
    const pagesA = await pdfToPngs(fileA.path, aDir);
    const pagesB = await pdfToPngs(fileB.path, bDir);

    const maxPages = Math.max(pagesA.length, pagesB.length);
    const summary = [];

    for (let i = 0; i < maxPages; i++) {
      const pa = pagesA[i];
      const pb = pagesB[i];

      const pageNo = i + 1;
      if (!pa || !pb) {
        summary.push({ page: pageNo, changed: true, changeRatio: 1, reason: "page-count-mismatch" });
        continue;
      }

      const outPath = path.join(diffDir, `diff_page_${String(pageNo).padStart(3, "0")}.png`);
      const { changeRatio } = await diffImages(pa, pb, outPath);

      const changed = changeRatio > 0.002; // tuned threshold
      summary.push({ page: pageNo, changed, changeRatio: Number(changeRatio.toFixed(6)) });
    }

    // write summary.json
    await fsp.writeFile(path.join(diffDir, "summary.json"), JSON.stringify({
      pagesA: pagesA.length,
      pagesB: pagesB.length,
      changedPages: summary.filter(s => s.changed).map(s => s.page),
      summary
    }, null, 2));

    // zip diff folder
    await zipFolder(diffDir, zipOut);

    // cleanup
    await safeRm(work);
    await safeRm(fileA.path);
    await safeRm(fileB.path);

    return res.download(zipOut, "pdf_compare_results.zip", async () => {
      await safeRm(zipOut);
    });
  } catch (e) {
    console.error("PDF Compare error:", e);
    await safeRm(work);
    await safeRm(fileA.path);
    await safeRm(fileB.path);
    await safeRm(zipOut);
    return res.status(500).json({ error: "Compare failed", details: e.message });
  }
});

export default router;
