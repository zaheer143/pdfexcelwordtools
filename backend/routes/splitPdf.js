import express from "express";
import multer from "multer";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/split-pdf", upload.single("file"), async (req, res) => {
  try {
    const fileBytes = fs.readFileSync(req.file.path);
    const originalPdf = await PDFDocument.load(fileBytes);

    const { start, end } = req.body;

    const startPage = parseInt(start);
    const endPage = parseInt(end);

    if (startPage < 1 || endPage > originalPdf.getPageCount()) {
      return res.status(400).send("Invalid page range");
    }

    const newPdf = await PDFDocument.create();
    const pagesToCopy = await newPdf.copyPages(
      originalPdf,
      Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage - 1 + i)
    );

    pagesToCopy.forEach((p) => newPdf.addPage(p));

    const finalBytes = await newPdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=split.pdf");
    return res.end(Buffer.from(finalBytes));

    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error("SPLIT ERROR:", err);
    res.status(500).send("Split failed");
  }
});

export default router;
