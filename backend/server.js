import express from "express";

const app = express();

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ✅ SAFE TEST ROUTE
app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("✅ Server started on port", PORT);
});
