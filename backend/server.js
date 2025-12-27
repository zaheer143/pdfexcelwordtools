import express from "express";

const app = express();

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("✅ Server started on port", PORT);
});
