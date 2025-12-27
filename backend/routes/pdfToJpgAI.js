import express from "express";
import multer from "multer";
import fs from "fs";
import { exec } from "child_process";
import JSZip from "jszip";
import sharp from "sharp";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/pdf-to-jpg-ai", upload.single("file"), async (req, res) => {
  try {
    // Add .pdf extension so poppler reads correctly
    let input = req.file.path;
    const pdfPath = `${input}.pdf`;
    fs.renameSync(input, pdfPath);
    input = pdfPath;

    const outputDir = "converted";
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    // Step 1: Convert PDF → JPG
    const cmd = `pdftoppm -jpeg "${input}" "${outputDir}/page"`;

    exec(cmd, async (err) => {
      if (err) {
        console.error("AI PDF → JPG ERROR:", err);
        return res.status(500).send("AI conversion failed.");
      }

      const zip = new JSZip();
      const files = fs.readdirSync(outputDir);

      for (const file of files) {
        if (file.endsWith(".jpg")) {
          const original = fs.readFileSync(`${outputDir}/${file}`);

          // Step 2: AI-like enhancement using Sharp
          const enhanced = await sharp(original)
            .sharpen()
            .normalize() // better contrast
            .jpeg({ quality: 90 })
            .toBuffer();

          zip.file(`enhanced-${file}`, enhanced);
        }
      }

      // Step 3: Send ZIP of enhanced images
      const zipContent = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=pdf_to_jpg_ai.zip"
      );
      res.end(zipContent);

      // Cleanup
      fs.unlinkSync(input);
      files.forEach((f) => fs.unlinkSync(`${outputDir}/${f}`));
    });

  } catch (err) {
    console.error("AI Server Error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
