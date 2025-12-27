import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ---------- BASIC HEALTH ----------
app.get("/", (req, res) => res.send("OK"));
app.get("/health", (req, res) => res.json({ ok: true }));

// ---------- SAFE CORE ROUTES ----------
app.use("/merge-pdf", async (req, res, next) =>
  (await import("./routes/mergePdf.js")).default(req, res, next)
);

app.use("/split-pdf", async (req, res, next) =>
  (await import("./routes/splitPdf.js")).default(req, res, next)
);

app.use("/protect-pdf", async (req, res, next) =>
  (await import("./routes/protectPdf.js")).default(req, res, next)
);

app.use("/unlock-pdf", async (req, res, next) =>
  (await import("./routes/unlockPdf.js")).default(req, res, next)
);

app.use("/rotate-pdf", async (req, res, next) =>
  (await import("./routes/rotatePdf.js")).default(req, res, next)
);

// ---------- IMAGE ----------
app.use("/pdf-to-jpg", async (req, res, next) =>
  (await import("./routes/pdfToJpg.js")).default(req, res, next)
);

app.use("/pdf-to-png", async (req, res, next) =>
  (await import("./routes/pdfToPng.js")).default(req, res, next)
);

app.use("/jpg-to-pdf", async (req, res, next) =>
  (await import("./routes/jpgToPdf.js")).default(req, res, next)
);

// ---------- OFFICE (LIBREOFFICE) ----------
app.use("/word-to-pdf", async (req, res, next) =>
  (await import("./routes/wordToPdf.js")).default(req, res, next)
);

app.use("/excel-to-pdf", async (req, res, next) =>
  (await import("./routes/excelToPdf.js")).default(req, res, next)
);

app.use("/ppt-to-pdf", async (req, res, next) =>
  (await import("./routes/pptToPdf.js")).default(req, res, next)
);

app.use("/pdf-to-excel", async (req, res, next) =>
  (await import("./routes/pdfToExcel.js")).default(req, res, next)
);

// ---------- ADVANCED PDF ----------
app.use("/watermark-pdf", async (req, res, next) =>
  (await import("./routes/watermarkPdf.js")).default(req, res, next)
);

app.use("/remove-pages", async (req, res, next) =>
  (await import("./routes/removePagesPdf.js")).default(req, res, next)
);

app.use("/add-page-numbers", async (req, res, next) =>
  (await import("./routes/addPageNumbersPdf.js")).default(req, res, next)
);

app.use("/delete-blank-pages", async (req, res, next) =>
  (await import("./routes/deleteBlankPages.js")).default(req, res, next)
);

app.use("/flatten-pdf", async (req, res, next) =>
  (await import("./routes/flattenPdf.js")).default(req, res, next)
);

app.use("/pdf-to-pdfa", async (req, res, next) =>
  (await import("./routes/pdfToPdfA.js")).default(req, res, next)
);

app.use("/compress-pdf", async (req, res, next) =>
  (await import("./routes/compressPdf.js")).default(req, res, next)
);

app.use("/compress-to-size", async (req, res, next) =>
  (await import("./routes/compressToSize.js")).default(req, res, next)
);

app.use("/grayscale-pdf", async (req, res, next) =>
  (await import("./routes/grayscalePdf.js")).default(req, res, next)
);

app.use("/remove-metadata", async (req, res, next) =>
  (await import("./routes/removeMetadata.js")).default(req, res, next)
);

app.use("/pdf-repair", async (req, res, next) =>
  (await import("./routes/pdfRepair.js")).default(req, res, next)
);

// ---------- OCR / AI ----------
app.use("/ocr-pdf", async (req, res, next) =>
  (await import("./routes/ocrPdf.js")).default(req, res, next)
);

// ---------- BULK ----------
app.use("/bulk-merge", async (req, res, next) =>
  (await import("./routes/bulkMergePdf.js")).default(req, res, next)
);

app.use("/bulk-split", async (req, res, next) =>
  (await import("./routes/bulkSplitPdf.js")).default(req, res, next)
);

app.use("/bulk-rotate", async (req, res, next) =>
  (await import("./routes/bulkRotatePdf.js")).default(req, res, next)
);

app.use("/bulk-compress", async (req, res, next) =>
  (await import("./routes/bulkCompressZip.js")).default(req, res, next)
);

app.use("/bulk-watermark", async (req, res, next) =>
  (await import("./routes/bulkWatermarkPdf.js")).default(req, res, next)
);

// ---------- START ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Backend running on port", PORT);
});
