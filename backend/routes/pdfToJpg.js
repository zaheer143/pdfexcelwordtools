import express from "express";
import multer from "multer";
import fs from "fs";
import { exec } from "child_process";
import JSZip from "jszip";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/pdf-to-jpg", upload.single("file"), async (req, res) => {
  try {
    // Fix: rename uploaded file to include .pdf
    let input = req.file.path;
    const pdfPath = `${input}.pdf`;

    fs.renameSync(input, pdfPath);
    input = pdfPath;

    const outputDir = "converted";
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const cmd = `pdftoppm -jpeg "${input}" "${outputDir}/page"`;

    exec(cmd, async (error) => {
      if (error) {
        console.error("PDF → JPG ERROR:", error);
        return res.status(500).send("Conversion failed");
      }

      const zip = new JSZip();
      const files = fs.readdirSync(outputDir);

      for (const file of files) {
        if (file.endsWith(".jpg")) {
          const img = fs.readFileSync(`${outputDir}/${file}`);
          zip.file(file, img);
        }
      }

      const zipContent = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=pdf_to_jpg.zip"
      );

      res.end(zipContent);

      // Cleanup
      fs.unlinkSync(input);
      files.forEach((f) => fs.unlinkSync(`${outputDir}/${f}`));
    });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
