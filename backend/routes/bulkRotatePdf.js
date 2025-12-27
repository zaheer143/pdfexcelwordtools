import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import unzipper from "unzipper";
import { PDFDocument, degrees } from "pdf-lib";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
const convertedDir = path.join(process.cwd(), "converted");
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(convertedDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 300 * 1024 * 1024 },
});

async function cleanup(...targets) {
  for (const t of targets) {
    try { await fsp.rm(t, { recursive: true, force: true }); } catch {}
  }
}

function safeName(name) {
  return String(name || "pdf").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "pdf";
}

async function rotatePdfBuffer(buffer, angleDeg) {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = doc.getPages();
  pages.forEach(p => p.setRotation(degrees(angleDeg)));
  return await doc.save();
}

async function findPdfsRecursive(dir) {
  const out = [];
  async function walk(d) {
    const entries = await fsp.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.toLowerCase().trim().endsWith(".pdf")) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

// POST /bulk-rotate-pdf
// form-data:
// - file (PDF or ZIP)  [also accepts legacy "pdf"]
// - angle: 90 | 180 | 270
router.post(
  "/",
  upload.fields([{ name: "file", maxCount: 1 }, { name: "pdf", maxCount: 1 }]),
  async (req, res) => {
    const uploaded = req.files?.file?.[0] || req.files?.pdf?.[0];
    if (!uploaded) return res.status(400).send("No file uploaded");

    const angle = parseInt(req.body.angle, 10);
    if (![90, 180, 270].includes(angle)) {
      return res.status(400).send("Invalid angle. Use 90, 180, or 270.");
    }

    const inputPath = uploaded.path;
    const originalLower = (uploaded.originalname || "").toLowerCase().trim();

    const zipName = `bulk_rotate_${Date.now()}.zip`;
    const zipPath = path.join(convertedDir, zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", async (err) => {
      console.error("Rotate archiver error:", err);
      try { archive.abort(); } catch {}
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Rotate failed (zip error)");
    });

    output.on("error", async (err) => {
      console.error("Rotate output error:", err);
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Rotate failed (write error)");
    });

    output.on("close", async () => {
      res.download(zipPath, zipName, async () => {
        await cleanup(zipPath);
      });
    });

    archive.pipe(output);

    try {
      let processed = 0;

      if (originalLower.endsWith(".pdf")) {
        const buf = await fsp.readFile(inputPath);
        const rotated = await rotatePdfBuffer(buf, angle);
        const base = safeName(path.parse(uploaded.originalname).name);
        archive.append(Buffer.from(rotated), { name: `${base}_rotated_${angle}.pdf` });
        processed = 1;

      } else if (originalLower.endsWith(".zip")) {
        const unzipDir = inputPath + "_unzipped";
        fs.mkdirSync(unzipDir, { recursive: true });

        await fs.createReadStream(inputPath)
          .pipe(unzipper.Extract({ path: unzipDir }))
          .promise();

        const pdfs = await findPdfsRecursive(unzipDir);
        if (pdfs.length === 0) {
          await cleanup(unzipDir, inputPath, zipPath);
          return res.status(400).send("No PDFs found inside the ZIP.");
        }

        for (const p of pdfs) {
          const buf = await fsp.readFile(p);
          const rotated = await rotatePdfBuffer(buf, angle);
          const base = safeName(path.parse(p).name);
          archive.append(Buffer.from(rotated), { name: `${base}_rotated_${angle}.pdf` });
          processed++;
        }

        await cleanup(unzipDir);
      } else {
        await cleanup(inputPath, zipPath);
        return res.status(400).send("Only PDF or ZIP supported");
      }

      await cleanup(inputPath);

      if (!processed) {
        await cleanup(zipPath);
        return res.status(400).send("Nothing to rotate.");
      }

      await archive.finalize();
    } catch (err) {
      console.error("Bulk rotate error:", err);
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Rotate failed");
    }
  }
);

export default router;
