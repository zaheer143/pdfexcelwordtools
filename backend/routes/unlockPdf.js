import express from "express";
import multer from "multer";
import fs from "fs";
import { exec } from "child_process";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/unlock-pdf", upload.single("file"), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).send("Password missing");

    const input = req.file.path;
    const output = `unlocked_${Date.now()}.pdf`;

    // 🔓 Unlock command using QPDF
    const cmd = `qpdf --password=${password} --decrypt "${input}" "${output}"`;

    exec(cmd, (err) => {
      if (err) {
        console.error("QPDF UNLOCK ERROR:", err);
        return res.status(500).send("Unlock failed. Wrong password?");
      }

      const fileData = fs.readFileSync(output);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=unlocked.pdf"
      );
      res.end(fileData);

      fs.unlinkSync(input);
      fs.unlinkSync(output);
    });
  } catch (err) {
    console.error("Unlock Error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
