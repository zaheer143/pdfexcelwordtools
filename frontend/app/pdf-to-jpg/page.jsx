"use client";

import { useState } from "react";
import Link from "next/link";

export default function PdfToJpg() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load file
  const handleFile = (e) => setFile(e.target.files[0]);

  // FREE Convert PDF → JPG
  const convertFree = async () => {
    if (!file) return alert("Please upload a PDF first.");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:3001/pdf-to-jpg", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        alert("Conversion failed. Check backend logs.");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "pdf_to_jpg.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Free Convert Error:", err);
      alert("Free conversion failed.");
    }

    setLoading(false);
  };

  // AI Convert PDF → Enhanced JPG
  const convertAI = async () => {
    if (!file) return alert("Please upload a PDF first.");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:3001/pdf-to-jpg-ai", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        alert("AI Conversion failed. Check backend logs.");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "pdf_to_jpg_ai.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("AI Convert Error:", err);
      alert("AI conversion failed.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>PDF → JPG</h1>

        <input
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          style={styles.fileInput}
        />

        <button
          style={styles.freeBtn}
          onClick={convertFree}
          disabled={loading}
        >
          {loading ? "Converting..." : "Convert (Free)"}
        </button>

        <button
          style={styles.premiumBtn}
          onClick={convertAI}
          disabled={loading}
        >
          {loading ? "Enhancing..." : "Convert with AI (Premium)"}
        </button>

        <Link href="/" style={styles.link}>
          Back Home
        </Link>
      </div>
    </div>
  );
}

// UI Styles — matches InvoiceOS card UI
const styles = {
  wrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginTop: 40,
  },
  card: {
    width: 520,
    background: "#fff",
    padding: 28,
    borderRadius: 14,
    textAlign: "center",
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 18,
  },
  fileInput: {
    display: "block",
    margin: "0 auto 18px auto",
  },
  freeBtn: {
    width: "100%",
    padding: 14,
    background: "#4a6cf7",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    cursor: "pointer",
    marginBottom: 12,
  },
  premiumBtn: {
    width: "100%",
    padding: 14,
    background: "#8a4cb8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    cursor: "pointer",
    marginBottom: 12,
  },
  link: {
    display: "block",
    marginTop: 10,
    color: "#5a2ca0",
    textDecoration: "underline",
  },
};
