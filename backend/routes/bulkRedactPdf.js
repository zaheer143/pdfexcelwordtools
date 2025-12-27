import express from "express";
import multer from "multer";
import archiver from "archiver";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB per file
});

/**
 * Mounted in server.js as:
 *   app.use("/bulk-redact-pdf", bulkRedactPdfRoutes);
 *
 * Endpoint:
 *   POST /bulk-redact-pdf
 * field: pdfs[]
 */
router.get("/", (_req, res) => res.json({ ok: true, route: "/bulk-redact-pdf" }));

router.post("/", upload.array("pdfs", 50), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "No PDFs uploaded" });

  // patterns can be overridden from FE if you want later
  const patterns = [
    { name: "Email", regex: "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", flags: "gi" },
    { name: "Phone(IN)", regex: "(?:\\+91[-\\s]?)?[6-9]\\d{9}", flags: "g" },
    { name: "PAN", regex: "\\b[A-Z]{5}\\d{4}[A-Z]\\b", flags: "g" },
    { name: "Aadhaar", regex: "\\b\\d{4}\\s?\\d{4}\\s?\\d{4}\\b", flags: "g" }
  ];

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="redacted_pdfs.zip"');

  const zip = archiver("zip", { zlib: { level: 9 } });
  zip.on("error", (e) => {
    console.error("ZIP ERROR:", e);
    if (!res.headersSent) res.status(500).json({ error: "ZIP error" });
  });
  zip.pipe(res);

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    for (const f of files) {
      const original = f.originalname || "file.pdf";
      try {
        const out = await redactPdfPermanentViaChromium(browser, f.buffer, patterns);
        const outName = original.replace(/\.pdf$/i, "") + "_REDACTED.pdf";
        zip.append(out, { name: outName });
      } catch (e) {
        const msg = `Failed: ${original}\nReason: ${e?.message || String(e)}\n`;
        zip.append(msg, { name: original.replace(/\.pdf$/i, "") + "_ERROR.txt" });
        console.error("REDACT FAIL:", original, e);
      }
    }

    await zip.finalize();
  } catch (e) {
    console.error("ROUTE FAIL:", e);
    if (!res.headersSent) res.status(500).json({ error: e?.message || "Server error" });
  } finally {
    try {
      if (browser) await browser.close();
    } catch {}
  }
});

export default router;

/* ===================== CORE ===================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// pdfjs-dist ships these builds
const PDFJS_LIB_PATH = resolveFromProject("pdfjs-dist/build/pdf.min.js");
const PDFJS_WORKER_PATH = resolveFromProject("pdfjs-dist/build/pdf.worker.min.js");

function resolveFromProject(rel) {
  // Works for normal node_modules layout
  return path.join(process.cwd(), "node_modules", rel);
}

function readFileSafe(p) {
  return fs.readFileSync(p, "utf-8");
}

async function redactPdfPermanentViaChromium(browser, pdfBuffer, patterns) {
  // Build output by rendering pages to PNG (with redactions) and rebuilding PDF
  const page = await browser.newPage();

  // Inject pdf.js library + worker (as data URL so it works offline)
  const pdfjsCode = readFileSafe(PDFJS_LIB_PATH);
  const workerCode = readFileSafe(PDFJS_WORKER_PATH);
  const workerDataUrl =
    "data:application/javascript;base64," + Buffer.from(workerCode, "utf-8").toString("base64");

  await page.setContent(`<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>${pdfjsCode}</script>
<script>
  // pdfjs is exposed as window['pdfjsLib'] in pdf.min.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${workerDataUrl}";
</script>
</body>
</html>`);

  const b64 = Buffer.from(pdfBuffer).toString("base64");

  const rendered = await page.evaluate(
    async ({ b64, patterns }) => {
      function toUint8Array(b64) {
        const bin = atob(b64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      }

      function buildRegex(p) {
        try {
          return new RegExp(p.regex, p.flags || "g");
        } catch {
          return null;
        }
      }

      const regs = (patterns || [])
        .map((p) => ({ name: p.name, re: buildRegex(p) }))
        .filter((x) => x.re);

      const data = toUint8Array(b64);
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      const images = [];

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const pg = await pdf.getPage(pageNo);
        const viewport = pg.getViewport({ scale: 2 });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const ctx = canvas.getContext("2d", { alpha: false });

        // White bg
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render page
        await pg.render({ canvasContext: ctx, viewport }).promise;

        // Get text items for PII detection
        const text = await pg.getTextContent();

        // Compute boxes for items that match PII
        const boxes = [];

        for (const it of text.items) {
          const s = (it.str || "").trim();
          if (!s) continue;

          let hit = false;
          for (const r of regs) {
            r.re.lastIndex = 0;
            if (r.re.test(s)) {
              hit = true;
              break;
            }
          }
          if (!hit) continue;

          // pdf.js text item transform → viewport coords
          // Common approach:
          // - transform[4], transform[5] is text origin in PDF space; in viewport space we combine with viewport.transform
          const tx = pdfjsLib.Util.transform(viewport.transform, it.transform);
          const x = tx[4];
          const y = tx[5];

          // Width/height are in viewport units in recent builds; fallback with transform scale
          const w = it.width || Math.abs(tx[0]) * (s.length || 1);
          const h = it.height || Math.abs(tx[3]) || 10;

          // Convert PDF y-up to canvas y-down:
          const yCanvas = canvas.height - y;

          // Add padding so we don't miss characters
          const padX = 2;
          const padY = 2;

          boxes.push({
            x: Math.max(0, x - padX),
            y: Math.max(0, yCanvas - h - padY),
            w: Math.min(canvas.width, w + padX * 2),
            h: Math.min(canvas.height, h + padY * 2)
          });
        }

        // Draw redaction boxes (permanent after raster)
        ctx.fillStyle = "#000000";
        for (const b of boxes) ctx.fillRect(b.x, b.y, b.w, b.h);

        images.push(canvas.toDataURL("image/png"));
      }

      return images;
    },
    { b64, patterns }
  );

  await page.close();

  // Rebuild PDF from images (this is the permanence guarantee)
  const out = await PDFDocument.create();
  for (const dataUrl of rendered) {
    const base64 = dataUrl.split(",")[1];
    const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const img = await out.embedPng(pngBytes);
    const w = img.width;
    const h = img.height;
    const p = out.addPage([w, h]);
    p.drawImage(img, { x: 0, y: 0, width: w, height: h });
  }

  return Buffer.from(await out.save());
}
