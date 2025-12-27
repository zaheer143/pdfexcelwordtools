import express from "express";

const router = express.Router();

router.post("/", (req, res) => {
  return res.status(503).json({
    error: "PDF→Word is temporarily disabled on Linux hosting. Coming soon.",
  });
});

export default router;
