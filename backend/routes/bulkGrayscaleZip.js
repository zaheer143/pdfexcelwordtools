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
const workBase = path.join(__dirname, "..", "work");
const outDir = path.join(__dirname, "..", "converted");

for (const d of [uploadDir, workBase, outDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename(req, file, cb) {
    cb(null, `bulk-${Date.now()}.zip`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.originalname.toLowerCase().endsWith(".zip"))
      return cb(new Error("Only ZIP allowed"));
    cb(null, true);
  },
});

const gsBin = () =>
  process.env.GHOSTSCRIPT_BIN ||
  (process.platform === "win32" ? "gswin64c" : "gs");

const safeRm = async (p) => {
  try { await fsp.rm(p, { recursive: true, force: true }); } catch {}
};

const unzip = (zip, dest) =>
  fs.createReadStream(zip).pipe(unzipper.Extract({ path: dest })).promise();

async function findPDFs(dir) {
  let out = [];
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(await findPDFs(p));
    else if (e.name.toLowerCase().endsWith(".pdf")) out.push(p);
  }
  return out;
}

function grayscalePDF(input, output) {
  return new Promise((resolve) => {
    const args = [
      "-sDEVICE=pdfwrite",
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-sProcessColorModel=DeviceGray",
      "-sColorConversionStrategy=Gray",
      `-sOutputFile=${output}`,
      input,
    ];
    const p = spawn(gsBin(), args);
    p.on("close", (c) => resolve(c === 0 && fs.existsSync(output)));
  });
}

router.post("/", upload.single("zip"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No ZIP uploaded" });

  const job = crypto.randomBytes(6).toString("hex");
  const work = path.join(workBase, job);
  const inputDir = path.join(work, "in");
  const outputDir = path.join(work, "out");
  const outZip = path.join(outDir, `bulk_grayscale_${job}.zip`);

  try {
    await fsp.mkdir(outputDir, { recursive: true });
    await unzip(req.file.path, inputDir);

    const pdfs = await findPDFs(inputDir);
    if (!pdfs.length) throw new Error("No PDFs found in ZIP");

    for (const pdf of pdfs) {
      const name = path.basename(pdf);
      await grayscalePDF(pdf, path.join(outputDir, name));
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outZip);
    archive.pipe(stream);
    archive.directory(outputDir, false);
    await archive.finalize();

    stream.on("close", async () => {
      await safeRm(work);
      await safeRm(req.file.path);
      res.download(outZip, () => safeRm(outZip));
    });
  } catch (e) {
    await safeRm(work);
    await safeRm(req.file.path);
    res.status(500).json({ error: "Bulk grayscale failed", details: e.message });
  }
});

export default router;
