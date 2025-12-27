import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import unzipper from "unzipper";
import { spawn } from "child_process";

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

async function findPdfsRecursive(dir) {
  const out = [];
  async function walk(d) {
    const entries = await fsp.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.toLowerCase().endsWith(".pdf")) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

function runQpdf(args) {
  const bin = process.env.QPDF_BIN || "qpdf"; // on Railway Docker: "qpdf" exists
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", (e) => reject(new Error(`qpdf spawn failed: ${e.message}`)));
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`qpdf failed (${code}): ${stderr || "Unknown error"}`));
    });
  });
}

/**
 * REAL password-on-open encryption:
 * - userPassword => required to open
 * - ownerPassword => permissions control
 * NOTE: qpdf supports 256-bit AES (good).
 */
async function protectPdfFile(inputPdf, outputPdf, userPassword, ownerPassword) {
  const user = userPassword;
  const owner = ownerPassword || userPassword;

  // You can tweak permissions here:
  // --print=full  / --print=none
  // --modify=none / --extract=n / --annotate=n etc
  const args = [
    "--encrypt",
    user,
    owner,
    "256",
    "--print=none",
    "--modify=none",
    "--extract=n",
    "--annotate=n",
    "--",
    inputPdf,
    outputPdf,
  ];

  await runQpdf(args);
}

// POST /bulk-protect-pdf
// form-data:
// - file (PDF or ZIP) [also accepts legacy "pdf"]
// - userPassword (required)
// - ownerPassword (optional)
router.post(
  "/",
  upload.fields([{ name: "file", maxCount: 1 }, { name: "pdf", maxCount: 1 }]),
  async (req, res) => {
    const uploaded = req.files?.file?.[0] || req.files?.pdf?.[0];
    if (!uploaded) return res.status(400).send("No file uploaded");

    const userPassword = String(req.body.userPassword || "").trim();
    const ownerPassword = String(req.body.ownerPassword || "").trim();
    if (!userPassword) {
      await cleanup(uploaded.path);
      return res.status(400).send("User password is required");
    }

    const inputPath = uploaded.path;
    const originalLower = (uploaded.originalname || "").toLowerCase().trim();

    const zipName = `bulk_protect_${Date.now()}.zip`;
    const zipPath = path.join(convertedDir, zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", async (err) => {
      console.error("Archiver error:", err);
      try { archive.abort(); } catch {}
      await cleanup(zipPath, inputPath);
      if (!res.headersSent) res.status(500).send("Zip creation failed");
    });

    output.on("close", async () => {
      res.download(zipPath, zipName, async () => {
        await cleanup(zipPath);
      });
    });

    archive.pipe(output);

    const tempOutDir = path.join(convertedDir, `bulk_protect_tmp_${Date.now()}`);
    fs.mkdirSync(tempOutDir, { recursive: true });

    try {
      let pdfPaths = [];

      if (originalLower.endsWith(".pdf")) {
        pdfPaths = [inputPath];
      } else if (originalLower.endsWith(".zip")) {
        const unzipDir = inputPath + "_unzipped";
        fs.mkdirSync(unzipDir, { recursive: true });

        await fs.createReadStream(inputPath)
          .pipe(unzipper.Extract({ path: unzipDir }))
          .promise();

        pdfPaths = await findPdfsRecursive(unzipDir);
        if (!pdfPaths.length) {
          await cleanup(unzipDir, inputPath, zipPath, tempOutDir);
          return res.status(400).send("No PDFs found inside ZIP");
        }

        // keep unzipDir for cleanup later
        req._unzipDir = unzipDir;
      } else {
        await cleanup(inputPath, zipPath, tempOutDir);
        return res.status(400).send("Only PDF or ZIP supported");
      }

      // Process each PDF -> encrypted -> append to zip
      for (const p of pdfPaths) {
        const base = safeName(path.parse(p).name);
        const outPdf = path.join(tempOutDir, `${base}_protected.pdf`);
        await protectPdfFile(p, outPdf, userPassword, ownerPassword);
        archive.file(outPdf, { name: `${base}_protected.pdf` });
      }

      await cleanup(inputPath);
      if (req._unzipDir) await cleanup(req._unzipDir);

      await archive.finalize();

      // tempOutDir cleanup after download happens? zip uses files now already read by archiver,
      // but safe to delete slightly later; simplest: leave and cleanup in a timeout.
      setTimeout(() => cleanup(tempOutDir), 30_000);
    } catch (err) {
      console.error("Bulk protect failed:", err);
      await cleanup(zipPath, inputPath, tempOutDir);
      if (req._unzipDir) await cleanup(req._unzipDir);
      if (!res.headersSent) res.status(500).send(err.message || "Bulk protect failed");
    }
  }
);

export default router;
