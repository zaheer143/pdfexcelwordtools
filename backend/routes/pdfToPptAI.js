// routes/pdfToPptAI.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import PPTXGenJS from "pptxgenjs";
import OpenAI from "openai";

const router = express.Router();

// File upload destination
const upload = multer({ dest: "uploads/" });

// Initialize OpenAI
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/***********************
 * Convert PDF → Images
 ************************/
function convertPdfToImages(pdfPath, outputPrefix) {
  return new Promise((resolve, reject) => {
    const command = `pdftoppm -jpeg -r 200 "${pdfPath}" "${outputPrefix}"`;

    exec(command, (err) => {
      if (err) {
        console.error("pdftoppm error:", err);
        return reject("Failed to convert PDF to images.");
      }

      // Collect generated images
      const folder = path.dirname(outputPrefix);
      const files = fs.readdirSync(folder);
      const jpgs = files
        .filter((f) => f.startsWith(path.basename(outputPrefix)) && f.endsWith(".jpg"))
        .map((f) => path.join(folder, f))
        .sort((a, b) => a.localeCompare(b));

      if (jpgs.length === 0) return reject("No images generated.");
      resolve(jpgs);
    });
  });
}

/***********************
 * AI SUMMARY
 ************************/
async function generateAISummary(pdfText) {
  try {
    const prompt = `
Summarize this PDF content into clear, bullet-point notes suitable for PowerPoint slide notes.
Keep it concise and structured.

Content:
${pdfText}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content || "";
  } catch (err) {
    console.error("AI Summary Error:", err);
    return "";
  }
}

/***********************
 * Extract PDF text for AI summary
 ************************/
function extractTextFromPdf(pdfPath) {
  return new Promise((resolve) => {
    const command = `pdftotext "${pdfPath}" -`;

    exec(command, (err, stdout) => {
      if (err) {
        console.warn("pdftotext failed — AI summary will be empty.");
        return resolve("");
      }
      resolve(stdout);
    });
  });
}

/***********************
 * MAIN ROUTE — AI PPT
 ************************/
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const pdfPath = req.file.path;
    const outputPrefix = path.join("converted", `page_${Date.now()}`);

    // Convert PDF → JPG images
    const images = await convertPdfToImages(pdfPath, outputPrefix);

    // Extract text for AI summary
    const pdfText = await extractTextFromPdf(pdfPath);
    const aiSummary = await generateAISummary(pdfText);

    // Create PPT
    const pptx = new PPTXGenJS();

    for (let imgPath of images) {
      const slide = pptx.addSlide();

      const imgBase64 = fs.readFileSync(imgPath).toString("base64");

      // FULL SLIDE IMAGE
      slide.addImage({
        data: `data:image/jpeg;base64,${imgBase64}`,
        x: 0,
        y: 0,
        w: "100%",
        h: "100%",
      });
    }

    // Add AI summary to the first slide's notes
    if (aiSummary.trim() !== "") {
      pptx.slides[0].addNotes(aiSummary);
    }

    // Save PPTX
    const outputFile = `ppt_${Date.now()}.pptx`;
    await pptx.writeFile(outputFile);

    res.download(outputFile, () => {
      fs.unlinkSync(outputFile);
      fs.unlinkSync(pdfPath);
      images.forEach((img) => fs.unlinkSync(img));
    });
  } catch (err) {
    console.error("PDF → PPT AI ERROR:", err);
    res.status(500).json({
      error: "Something went wrong while generating the PPT.",
    });
  }
});

export default router;
