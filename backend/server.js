import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// 🔴 IMPORTANT: pdfToWord is DISABLED (Windows-only, crashes Linux)
// import pdfToWord from "./routes/pdfToWord.js";

import mergePdf from "./routes/mergePdf.js";
import splitPdfRoutes from "./routes/splitPdf.js";
import protectPdfRoutes from "./routes/protectPdf.js";
import unlockPdfRoutes from "./routes/unlockPdf.js";
import pdfToJpgRoutes from "./routes/pdfToJpg.js";
import pdfToJpgAIRoutes from "./routes/pdfToJpgAI.js";
import compressPdfRoutes from "./routes/compressPdf.js";
import compressPdfAIRoutes from "./routes/compressPdfAI.js";
import pdfToPptRoutes from "./routes/pdfToPpt.js";
import pdfToPptAIRoutes from "./routes/pdfToPptAI.js";
import jpgToPdfRoutes from "./routes/jpgToPdf.js";

import extractImagesRoutes from "./routes/extractImages.js";
import wordToPdfRoutes from "./routes/wordToPdf.js";
import excelToPdfRoutes from "./routes/excelToPdf.js";
import pptToPdfRoutes from "./routes/pptToPdf.js";
import pdfToExcelRoutes from "./routes/pdfToExcel.js";
import rotatePdfRoutes from "./routes/rotatePdf.js";
import watermarkPdfRoutes from "./routes/watermarkPdf.js";
import removePagesPdfRoutes from "./routes/removePagesPdf.js";
import addPageNumbersPdfRoutes from "./routes/addPageNumbersPdf.js";
import pdfToPngRoutes from "./routes/pdfToPng.js";
import pdfToTxtRoutes from "./routes/pdfToTxt.js";
import deleteBlankPagesRoutes from "./routes/deleteBlankPages.js";
import typeOnPdfRoutes from "./routes/typeOnPdf.js";
import ocrPdfRoutes from "./routes/ocrPdf.js";
import flattenPdfRoutes from "./routes/flattenPdf.js";
import pdfToPdfARoute from "./routes/pdfToPdfA.js";
import compressToSizeRoutes from "./routes/compressToSize.js";
import grayscalePdfRoutes from "./routes/grayscalePdf.js";
import removeMetadataRoutes from "./routes/removeMetadata.js";
import pdfRepairRoutes from "./routes/pdfRepair.js";
import bulkCompressZipRoutes from "./routes/bulkCompressZip.js";
import bulkGrayscaleZip from "./routes/bulkGrayscaleZip.js";
import splitBySizeRoutes from "./routes/splitBySize.js";
import comparePdfRoutes from "./routes/comparePdf.js";
import bulkWatermarkPdfRoutes from "./routes/bulkWatermarkPdf.js";
import bulkRenamePdfRoutes from "./routes/bulkRenamePdf.js";
import bulkMergePdfRoutes from "./routes/bulkMergePdf.js";
import bulkSplitPdfRoutes from "./routes/bulkSplitPdf.js";
import bulkRotatePdfRoutes from "./routes/bulkRotatePdf.js";
import bulkPageNumbersPdfRoutes from "./routes/bulkPageNumbersPdf.js";
import bulkProtectPdfRoutes from "./routes/bulkProtectPdf.js";
import bulkRedactPdfRoutes from "./routes/bulkRedactPdf.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 🔴 pdfToWord DISABLED
// app.use("/", pdfToWord);

app.use("/", mergePdf);
app.use("/", splitPdfRoutes);
app.use("/", protectPdfRoutes);
app.use("/", unlockPdfRoutes);
app.use("/", pdfToJpgRoutes);
app.use("/", pdfToJpgAIRoutes);
app.use("/compress-pdf", compressPdfRoutes);
app.use("/", compressPdfAIRoutes);
app.use("/pdf-to-ppt", pdfToPptRoutes);
app.use("/pdf-to-ppt-ai", pdfToPptAIRoutes);
app.use("/jpg-to-pdf", jpgToPdfRoutes);
app.use("/rotate-pdf", rotatePdfRoutes);

app.use("/extract-images", extractImagesRoutes);
app.use("/word-to-pdf", wordToPdfRoutes);
app.use("/excel-to-pdf", excelToPdfRoutes);
app.use("/ppt-to-pdf", pptToPdfRoutes);
app.use("/pdf-to-excel", pdfToExcelRoutes);
app.use("/watermark-pdf", watermarkPdfRoutes);
app.use("/remove-pages", removePagesPdfRoutes);
app.use("/add-page-numbers", addPageNumbersPdfRoutes);
app.use("/pdf-to-png", pdfToPngRoutes);
app.use("/pdf-to-txt", pdfToTxtRoutes);
app.use("/delete-blank-pages", deleteBlankPagesRoutes);
app.use("/type-on-pdf", typeOnPdfRoutes);
app.use("/ocr-pdf", ocrPdfRoutes);
app.use("/flatten-pdf", flattenPdfRoutes);
app.use("/pdf-to-pdfa", pdfToPdfARoute);
app.use("/compress-to-size", compressToSizeRoutes);
app.use("/grayscale-pdf", grayscalePdfRoutes);
app.use("/remove-metadata", removeMetadataRoutes);
app.use("/pdf-repair", pdfRepairRoutes);
app.use("/bulk-compress", bulkCompressZipRoutes);
app.use("/bulk-grayscale", bulkGrayscaleZip);
app.use("/split-by-size", splitBySizeRoutes);
app.use("/compare-pdf", comparePdfRoutes);
app.use("/bulk-watermark-pdf", bulkWatermarkPdfRoutes);
app.use("/bulk-rename-pdf", bulkRenamePdfRoutes);
app.use("/bulk-merge-pdf", bulkMergePdfRoutes);
app.use("/bulk-split-pdf", bulkSplitPdfRoutes);
app.use("/bulk-rotate-pdf", bulkRotatePdfRoutes);
app.use("/bulk-page-numbers-pdf", bulkPageNumbersPdfRoutes);
app.use("/bulk-protect-pdf", bulkProtectPdfRoutes);
app.use("/bulk-redact-pdf", bulkRedactPdfRoutes);

// ✅ REQUIRED FOR RAILWAY
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
