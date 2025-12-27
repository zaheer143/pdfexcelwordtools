import express from "express";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse-fixed";
import pkg from "pdf-lib";
import PDFDocument from "pdfkit";
import OpenAI from "openai";

const { PDFDocument: PDFLibDoc } = pkg;

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ------------------------------------------------------
   FREE MERGE (pdf-lib)
--------------------------------------------------------- */
router.post("/merge-pdf", upload.array("files", 10), async (req, res) => {
  try {
    const merged = await PDFLibDoc.create();

    for (const file of req.files) {
      const bytes = fs.readFileSync(file.path);
      const pdf = await PDFLibDoc.load(bytes);

      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => merged.addPage(p));

      fs.unlinkSync(file.path);
    }

    const output = await merged.save();
    res.setHeader("Content-Disposition", "attachment; filename=merged.pdf");
    res.send(Buffer.from(output));
  } catch (err) {
    console.error("FREE MERGE ERROR:", err);
    res.status(500).send("Merge failed");
  }
});

/* ------------------------------------------------------
   AI MERGE (pdfkit — FULL IN-MEMORY BUFFER)
--------------------------------------------------------- */
router.post("/merge-pdf-ai", upload.array("files", 10), async (req, res) => {
  try {
    // Step 1: Merge PDFs using pdf-lib
    const merged = await PDFLibDoc.create();

    for (const file of req.files) {
      const bytes = fs.readFileSync(file.path);
      const pdf = await PDFLibDoc.load(bytes);

      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => merged.addPage(p));

      fs.unlinkSync(file.path);
    }

    const mergedBytes = await merged.save();

    // Step 2: Extract text
    const parsed = await pdfParse(Buffer.from(mergedBytes));
    const fullText = parsed.text;

    // Step 3: AI cleanup (chunk-safe)
    let improved = "";
    const chunkSize = 8000;

    for (let i = 0; i < fullText.length; i += chunkSize) {
      const chunk = fullText.substring(i, i + chunkSize);

      const ai = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content:
              "Clean this merged PDF text. DO NOT summarize. Fix spacing and readability:\n\n" +
              chunk,
          },
        ],
      });

      improved += ai.choices[0].message.content + "\n\n";
    }

    // Step 4: Create PDF IN MEMORY using pdfkit
    const doc = new PDFDocument({ margin: 40 });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const finalPDF = Buffer.concat(buffers);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=merged_ai.pdf"
      );
      res.send(finalPDF);
    });

    // Write improved text
    const lines = improved.split("\n");
    lines.forEach((line) => {
      doc.text(line.trim(), { paragraphGap: 8 });
    });

    doc.end();
  } catch (err) {
    console.error("AI MERGE ERROR:", err);
    res.status(500).send("AI merge failed.");
  }
});

export default router;
