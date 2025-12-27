"use client";

import { useState } from "react";
import Link from "next/link";

export default function PdfToPpt() {
  const [file, setFile] = useState(null);
  const [loadingFree, setLoadingFree] = useState(false);
  const [loadingAI,   setLoadingAI] = useState(false);

  const handleUpload = (e) => setFile(e.target.files[0]);

  const convert = async (mode) => {
    if (!file) return alert("Please upload a PDF first.");
    mode === "free" ? setLoadingFree(true) : setLoadingAI(true);

    const formData = new FormData();
    formData.append("file", file);

    const endpoint =
      mode === "free"
        ? "http://localhost:3001/pdf-to-ppt"
        : "http://localhost:3001/pdf-to-ppt-ai";

    const res = await fetch(endpoint, { method: "POST", body: formData });

    if (!res.ok) {
      alert("Conversion failed.");
      setLoadingFree(false);
      setLoadingAI(false);
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = mode === "free" ? "converted.pptx" : "ai_converted.pptx";
    link.click();

    setLoadingFree(false);
    setLoadingAI(false);
  };

  return (
    <div className="card">
      <h1>PDF → PPT</h1>

      <input type="file" accept="application/pdf" onChange={handleUpload} />

      <button
        className="btn btn-free"
        onClick={() => convert("free")}
        disabled={loadingFree}
      >
        {loadingFree ? "Converting..." : "Convert (Free)"}
      </button>

      <button
        className="btn btn-ai"
        onClick={() => convert("ai")}
        disabled={loadingAI}
      >
        {loadingAI ? "Converting with AI..." : "Convert with AI (Premium)"}
      </button>

      <Link href="/" className="back-link">
        Back Home
      </Link>
    </div>
  );
}
