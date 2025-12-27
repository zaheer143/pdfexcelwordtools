import express from "express";
import multer from "multer";
import fs from "fs";
import { exec } from "child_process";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// AI compression = Optimize images + run Ghostscript
router.post("/compress-pdf-ai", upload.single("file"), async (req, res) => {
  try {
    const input = req.file.path;
    const tempOptimized = `optimized_${Date.now()}.pdf`;
    const finalOutput = `compressed_ai_${Date.now()}.pdf`;

    // Step 1: Load PDF using pdf-lib
    const buffer = fs.readFileSync(input);
    const pdf = await PDFDocument.load(buffer);

    const pages = pdf.getPages();

    // Step 2: Extract + compress images using Sharp
    for (const page of pages) {
      const images = page.node.Resources().lookupMaybe("XObject");

      if (images) {
        const keys = images.keys();

        for (const key of keys) {
          const img = images.lookup(key);

          if (!img) continue;

          const raw = img.getContent();

          try {
            const optimizedImage = await sharp(raw)
              .jpeg({ quality: 70 })
              .toBuffer();

            img.setContent(optimizedImage);
          } catch (err) {
            console.log("Skipping non-image resource");
          }
        }
      }
    }

    const optimizedPdf = await pdf.save();
    fs.writeFileSync(tempOptimized, optimizedPdf);

    // Step 3: Ghostscript final compression pass
    const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${finalOutput} ${tempOptimized}`;

    exec(cmd, (err) => {
      if (err) {
        console.error("AI COMPRESS ERROR:", err);
        return res.status(500).send("AI compression failed.");
      }

      const fileData = fs.readFileSync(finalOutput);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=compressed_ai.pdf");
      res.end(fileData);

      fs.unlinkSync(input);
      fs.unlinkSync(tempOptimized);
      fs.unlinkSync(finalOutput);
    });

  } catch (err) {
    console.error("AI Server Error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
