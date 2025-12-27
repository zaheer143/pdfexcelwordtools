"use client";

import { useState } from "react";
import Link from "next/link";

export default function SplitPDF() {
  const [file, setFile] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const splitPdf = async () => {
    if (!file || !start || !end) {
      alert("Upload a PDF and enter page range.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("start", start);
    formData.append("end", end);

    const response = await fetch("http://localhost:3001/split-pdf", {
      method: "POST",
      body: formData,
    });

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });

    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "split.pdf";
    link.click();

    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Split PDF</h1>

        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} style={{ marginTop: 10 }} />

        <input
          type="number"
          placeholder="Start Page"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          style={styles.input}
        />

        <input
          type="number"
          placeholder="End Page"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          style={styles.input}
        />

        <button style={styles.freeBtn} onClick={splitPdf} disabled={loading}>
          {loading ? "Splitting..." : "Split PDF"}
        </button>

        <Link href="/compress-pdf" style={styles.link}>
          Go to Compress PDF
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
