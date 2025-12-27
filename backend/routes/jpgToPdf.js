import express from "express";
import multer from "multer";
import fs from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "path";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// JPG/PNG → PDF converter
router.post("/", upload.array("images"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No images uploaded" });

    const pdfDoc = await PDFDocument.create();

    for (const file of req.files) {
      const imageBytes = fs.readFileSync(file.path);
      let image;

      if (file.mimetype === "image/png") {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        image = await pdfDoc.embedJpg(imageBytes);
      }

      const { width, height } = image.scale(1);

      const page = pdfDoc.addPage([width, height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const outputFile = `jpg_to_pdf_${Date.now()}.pdf`;

    fs.writeFileSync(outputFile, pdfBytes);

    // Return file
    res.download(outputFile, () => {
      req.files.forEach((file) => fs.unlinkSync(file.path));
      fs.unlinkSync(outputFile);
    });
  } catch (error) {
    console.error("JPG → PDF Error:", error);
    res.status(500).json({ error: "Conversion failed" });
  }
});

export default router;
