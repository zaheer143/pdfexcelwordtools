import express from "express";
import multer from "multer";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import pptxgen from "pptxgenjs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded.");

    const inputPath = req.file.path;
    const folder = `converted_${Date.now()}`;
    fs.mkdirSync(folder);

    // Convert PDF -> JPG using Poppler (pdftoppm)
    const cmd = `pdftoppm -jpeg "${inputPath}" "${folder}/page"`;
    execSync(cmd);

    const pptx = new pptxgen();
    const images = fs.readdirSync(folder).filter(f => f.endsWith(".jpg"));

    // Sort pages numerically
    images.sort((a, b) => {
      const aNum = parseInt(a.replace("page-", "").replace(".jpg", ""));
      const bNum = parseInt(b.replace("page-", "").replace(".jpg", ""));
      return aNum - bNum;
    });

    for (const img of images) {
      const imgPath = path.join(folder, img);
      const base64 = fs.readFileSync(imgPath, { encoding: "base64" });

      const slide = pptx.addSlide();
      slide.addImage({
        data: `data:image/jpeg;base64,${base64}`,
        x: 0,
        y: 0,
        w: "100%",
        h: "100%"
      });
    }

    const filename = `converted_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: filename });

    res.download(filename, filename, () => {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(filename);
      fs.rmSync(folder, { recursive: true });
    });

  } catch (err) {
    console.error("PDF → PPT ERROR:", err);
    res.status(500).send("Conversion failed.");
  }
});

export default router;
