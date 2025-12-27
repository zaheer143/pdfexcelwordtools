import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import unzipper from "unzipper";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
  return String(name || "pdf")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim() || "pdf";
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

function calcPos(position, w, h, textWidth, size) {
  const margin = 18;

  // default bottom-center
  let x = (w - textWidth) / 2;
  let y = margin;

  if (position === "bottom-right") {
    x = w - textWidth - margin;
    y = margin;
  } else if (position === "top-right") {
    x = w - textWidth - margin;
    y = h - size - margin;
  } else if (position === "top-center") {
    x = (w - textWidth) / 2;
    y = h - size - margin;
  }

  return { x, y };
}

async function addPageNumbersBuffer({ buffer, startAt, position, fontSize, color }) {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    const n = startAt + i;
    const label = String(n);

    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { x, y } = calcPos(position, width, height, textWidth, fontSize);

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color,
      opacity: 0.9,
    });
  }

  return await pdf.save();
}

// POST /bulk-page-numbers-pdf
// form-data:
// - file (PDF or ZIP)  [also accepts legacy "pdf"]
// - startAt (default 1)
// - position: bottom-center | bottom-right | top-right | top-center
// - fontSize (default 12)
router.post(
  "/",
  upload.fields([{ name: "file", maxCount: 1 }, { name: "pdf", maxCount: 1 }]),
  async (req, res) => {
    const uploaded = req.files?.file?.[0] || req.files?.pdf?.[0];
    if (!uploaded) return res.status(400).send("No file uploaded");

    const startAt = Math.max(1, parseInt(req.body.startAt ?? "1", 10) || 1);
    const position = String(req.body.position || "bottom-center");
    const fontSize = Math.min(48, Math.max(8, parseInt(req.body.fontSize ?? "12", 10) || 12));

    // nice neutral color
    const color = rgb(0.20, 0.20, 0.20);

    const inputPath = uploaded.path;
    const originalLower = (uploaded.originalname || "").toLowerCase().trim();

    const zipName = `bulk_page_numbers_${Date.now()}.zip`;
    const zipPath = path.join(convertedDir, zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", async (err) => {
      console.error("Page numbers archiver error:", err);
      try { archive.abort(); } catch {}
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Page numbers failed (zip error)");
    });

    output.on("error", async (err) => {
      console.error("Page numbers output error:", err);
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Page numbers failed (write error)");
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
        const out = await addPageNumbersBuffer({ buffer: buf, startAt, position, fontSize, color });
        const base = safeName(path.parse(uploaded.originalname).name);
        archive.append(Buffer.from(out), { name: `${base}_pagenumbered.pdf` });
        processed = 1;

      } else if (originalLower.endsWith(".zip")) {
        const unzipDir = inputPath + "_unzipped";
        fs.mkdirSync(unzipDir, { recursive: true });

        await fs.createReadStream(inputPath)
          .pipe(unzipper.Extract({ path: unzipDir }))
          .promise();

        const pdfs = await findPdfsRecursive(unzipDir);
        if (!pdfs.length) {
          await cleanup(unzipDir, inputPath, zipPath);
          return res.status(400).send("No PDFs found inside the ZIP.");
        }

        for (const p of pdfs) {
          const buf = await fsp.readFile(p);
          const out = await addPageNumbersBuffer({ buffer: buf, startAt, position, fontSize, color });
          const base = safeName(path.parse(p).name);
          archive.append(Buffer.from(out), { name: `${base}_pagenumbered.pdf` });
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
        return res.status(400).send("Nothing processed");
      }

      await archive.finalize();
    } catch (err) {
      console.error("Bulk page numbers error:", err);
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Page numbers failed");
    }
  }
);

export default router;
