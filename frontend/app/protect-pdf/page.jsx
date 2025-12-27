"use client";

import { useState } from "react";
import Link from "next/link";

export default function ProtectPDF() {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const protect = async () => {
    if (!file || !password) {
      alert("Please upload a PDF and enter a password.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    try {
      const response = await fetch("http://localhost:3001/protect-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        alert("Something went wrong while protecting the PDF.");
        return;
      }

      // ⭐ FINAL FIX → CORRECT BLOB DOWNLOAD (no corruption)
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "protected.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to process PDF.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Protect PDF</h1>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginTop: 10 }}
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        <button style={styles.freeBtn} onClick={protect} disabled={loading}>
          {loading ? "Encrypting..." : "Protect PDF"}
        </button>

        <Link href="/" style={styles.link}>
          Go Home
        </Link>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginTop: 40,
  },
  card: {
    width: 450,
    background: "#fff",
    padding: 30,
    borderRadius: 15,
    textAlign: "center",
    boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
  },
  title: { fontSize: 30, fontWeight: "bold", marginBottom: 20 },
  input: {
    width: "100%",
    padding: 12,
    marginTop: 15,
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 16,
  },
  freeBtn: {
    width: "100%",
    padding: 14,
    background: "#4a6cf7",
    color: "#fff",
    border: "none",
    marginTop: 20,
    borderRadius: 8,
    fontSize: 16,
    cursor: "pointer",
  },
  link: {
    display: "block",
    marginTop: 20,
    color: "#4a6cf7",
    textDecoration: "none",
  },
};
