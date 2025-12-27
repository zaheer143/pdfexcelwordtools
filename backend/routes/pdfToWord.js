import express from "express";
import multer from "multer";
import fs from "fs";
import pdf from "pdf-parse-fixed";
import pkg from "docx";   // FIXED IMPORT
import OpenAI from "openai";

const { Document, Paragraph, Packer } = pkg;  // FIXED DESTRUCTURE

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ------------ FREE VERSION ------------ */
router.post("/pdf-to-word", upload.single("file"), async (req, res) => {
  try {
    const buffer = fs.readFileSync(req.file.path);
    const parsed = await pdf(buffer);

    const lines = parsed.text.split("\n");

    const doc = new Document({
      sections: [
        {
          children: lines.map((line) => new Paragraph(line)),
        },
      ],
    });

    const out = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=converted.docx"
    );
    res.send(out);

    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error("FREE ERROR:", err);
    res.status(500).send("Free conversion failed.");
  }
});

/* ------------ AI VERSION ------------ */
router.post("/pdf-to-word-ai", upload.single("file"), async (req, res) => {
  try {
    const buffer = fs.readFileSync(req.file.path);
    const parsed = await pdf(buffer);

    const fullText = parsed.text;

    // Split into safe chunks
    const chunkSize = 6000;
    const chunks = [];
    for (let i = 0; i < fullText.length; i += chunkSize) {
      chunks.push(fullText.slice(i, i + chunkSize));
    }

    let formatted = "";

    for (const chunk of chunks) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content:
              "Format this text for a Word document. Keep all content. Fix spacing and paragraphs:\n\n" +
              chunk,
          },
        ],
      });

      formatted += completion.choices[0].message.content + "\n\n";
    }

    const lines = formatted
      .replace(/\r/g, "")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    const doc = new Document({
      sections: [
        {
          children: lines.map((line) => new Paragraph(line.trim())),
        },
      ],
    });

    const out = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=AI_converted.docx"
    );
    res.send(out);

    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).send("AI conversion failed.");
  }
});

export default router;
