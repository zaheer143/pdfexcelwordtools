import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

// ✅ SAFE: lazy-load route
app.use("/merge-pdf", async (req, res, next) => {
  const { default: mergePdf } = await import("./routes/mergePdf.js");
  return mergePdf(req, res, next);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("✅ Server started on port", PORT);
});
