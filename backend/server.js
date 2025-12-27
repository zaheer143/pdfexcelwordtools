import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Base
app.get("/", (req, res) => res.send("OK"));
app.get("/health", (req, res) => res.json({ ok: true }));

// Helper: lazy-load routers safely on Linux
const mount = (path, file) => {
  app.use(path, async (req, res, next) => {
    try {
      const mod = await import(file);
      return mod.default(req, res, next);
    } catch (e) {
      console.error("Route load failed:", path, file, e);
      return res.status(500).json({ error: `Route load failed: ${path}` });
    }
  });
};

// ---- PDF core ----
mount("/merge-pdf", "./routes/mergePdf.js");
mount("/split-pdf", "./routes/splitPdf.js");
mount("/protect-pdf", "./routes/protectPdf.js");
mount("/unlock-pdf", "./routes/unlockPdf.js");
mount("/rotate-pdf", "./routes/rotatePdf.js");

// ---- Image ----
mount("/pdf-to-jpg", "./routes/pdfToJpg.js");
mount("/pdf-to-png", "./routes/pdfToPng.js");
mount("/jpg-to-pdf", "./routes/jpgToPdf.js");
mount("/extract-images", "./routes/extractImages.js");

// ---- Compress / repair / metadata ----
mount("/compress-pdf", "./routes/compressPdf.js");
mount("/compress-to-size", "./routes/compressToSize.js");
mount("/pdf-repair", "./routes/pdfRepair.js");
mount("/remove-metadata", "./routes/removeMetadata.js");
mount("/grayscale-pdf", "./routes/grayscalePdf.js");
mount("/flatten-pdf", "./routes/flattenPdf.js");
mount("/pdf-to-pdfa", "./routes/pdfToPdfA.js");
mount("/delete-blank-pages", "./routes/deleteBlankPages.js");
mount("/remove-pages", "./routes/removePagesPdf.js");
mount("/add-page-numbers", "./routes/addPageNumbersPdf.js");
mount("/watermark-pdf", "./routes/watermarkPdf.js");

// ---- Office (LibreOffice) ----
mount("/word-to-pdf", "./routes/wordToPdf.js");
mount("/excel-to-pdf", "./routes/excelToPdf.js");
mount("/ppt-to-pdf", "./routes/pptToPdf.js");
mount("/pdf-to-excel", "./routes/pdfToExcel.js");

// ---- OCR ----
mount("/ocr-pdf", "./routes/ocrPdf.js");

// ---- Bulk ----
mount("/bulk-compress", "./routes/bulkCompressZip.js");
mount("/bulk-grayscale", "./routes/bulkGrayscaleZip.js");
mount("/bulk-watermark-pdf", "./routes/bulkWatermarkPdf.js");
mount("/bulk-rename-pdf", "./routes/bulkRenamePdf.js");
mount("/bulk-merge-pdf", "./routes/bulkMergePdf.js");
mount("/bulk-split-pdf", "./routes/bulkSplitPdf.js");
mount("/bulk-rotate-pdf", "./routes/bulkRotatePdf.js");
mount("/bulk-page-numbers-pdf", "./routes/bulkPageNumbersPdf.js");
mount("/bulk-protect-pdf", "./routes/bulkProtectPdf.js");
mount("/bulk-redact-pdf", "./routes/bulkRedactPdf.js");

// ---- Disabled / dangerous (do NOT mount on Linux now) ----
// pdfToWord was Windows-only and previously caused linux crash loops.
// mount("/pdf-to-word", "./routes/pdfToWord.js");

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Backend running on port", PORT);
});
