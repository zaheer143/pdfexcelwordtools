// backend/routes/excelToPdf.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import crypto from "crypto";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base uploads folder
const uploadFolder = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

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
  fileFilter(req, file, cb) {
    const allowed = [
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only .xls and .xlsx files are allowed"));
    }
    cb(null, true);
  },
});

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // ✅ Portable default
  const sofficePath = process.env.LIBREOFFICE_BIN || "soffice";

  const inputPath = req.file.path;

  // ✅ per-job output dir to avoid collisions
  const jobId = crypto.randomBytes(8).toString("hex");
  const outputDir = path.join(uploadFolder, jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log("EXCEL→PDF | soffice:", sofficePath);
  console.log("EXCEL→PDF | input:", inputPath);
  console.log("EXCEL→PDF | outdir:", outputDir);

  const args = [
    "--headless",
    "--nologo",
    "--norestore",
    "--convert-to",
    "pdf",
    "--outdir",
    outputDir,
    inputPath,
  ];

  const child = spawn(sofficePath, args);

  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  // ✅ handle spawn errors (soffice missing, permission, etc.)
  child.on("error", (err) => {
    fs.unlink(inputPath, () => {});
    fs.rm(outputDir, { recursive: true, force: true }, () => {});
    console.error("EXCEL→PDF | spawn error:", err);
    return res
      .status(500)
      .json({ error: `LibreOffice spawn failed: ${err.message}` });
  });

  child.on("close", (code) => {
    // clean input file
    fs.unlink(inputPath, () => {});

    if (code !== 0) {
      console.error("EXCEL→PDF | LibreOffice code", code, stderr);
      fs.rm(outputDir, { recursive: true, force: true }, () => {});
      return res
        .status(500)
        .json({ error: `LibreOffice failed: ${stderr || "Unknown error"}` });
    }

    // ✅ don’t assume exact output name
    let pdfFile = null;
    try {
      const files = fs.readdirSync(outputDir);
      pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));
    } catch (e) {
      console.error("EXCEL→PDF | read output dir error:", e);
    }

    if (!pdfFile) {
      console.error("EXCEL→PDF | output not found in:", outputDir);
      fs.rm(outputDir, { recursive: true, force: true }, () => {});
      return res
        .status(500)
        .json({ error: "Conversion failed (no output file created)" });
    }

    const pdfPath = path.join(outputDir, pdfFile);

    res.download(pdfPath, pdfFile, (err) => {
      fs.rm(outputDir, { recursive: true, force: true }, () => {});
      if (err) {
        console.error("EXCEL→PDF | send error:", err);
      }
    });
  });
});

export default router;
