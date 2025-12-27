import express from "express";
import multer from "multer";
import fs from "fs";
import { exec } from "child_process";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/protect-pdf", upload.single("file"), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).send("Password missing");

    const input = req.file.path;
    const output = `protected_${Date.now()}.pdf`;

    // 🔥 USE AES-256 ENCRYPTION (Recommended by Adobe + QPDF)
    const cmd = `qpdf --encrypt ${password} ${password} 256 -- "${input}" "${output}"`;

    exec(cmd, (err) => {
      if (err) {
        console.error("QPDF ERROR:", err);
        return res.status(500).send("Encryption failed");
      }

      const fileData = fs.readFileSync(output);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=protected.pdf"
      );
      res.end(fileData);

      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  } catch (err) {
    console.error("Protect Error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
