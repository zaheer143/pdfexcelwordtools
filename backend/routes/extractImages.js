import express from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import archiver from "archiver";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/extract-images", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No PDF uploaded");

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const zipPath = path.join("downloads", `images_${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip");

    archive.pipe(output);

    let imageCount = 0;

    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      const page = pdfDoc.getPage(i);
      const images = page.node.Resources()?.lookup("XObject") || {};

      for (const key in images) {
        const xObj = images[key];

        if (xObj?.lookup) {
          const img = xObj.lookup("Image");
          if (!img) continue;

          const imgBytes = img.getContent();
          if (!imgBytes) continue;

          imageCount++;
          archive.append(Buffer.from(imgBytes), { name: `image_${imageCount}.jpg` });
        }
      }
    }

    archive.finalize();

    output.on("close", () => {
      fs.unlinkSync(req.file.path); 
      if (imageCount === 0) {
        return res.status(400).json({ error: "No images found in PDF" });
      }
      res.download(zipPath, () => fs.unlinkSync(zipPath));
    });

  } catch (err) {
    console.error("Extract Error:", err);
    res.status(500).send("Failed to extract images");
  }
});

export default router;
