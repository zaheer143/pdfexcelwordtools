"use client";

import { useState, useRef } from "react";

export default function ExtractImages() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (e) => {
    setFile(e.target.files[0]);
  };

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const extract = async () => {
    if (!file) return alert("Upload a PDF first");

    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("http://localhost:3001/extract-images", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const msg = await res.text();
        alert("Extraction failed:\n\n" + msg);
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `extracted_images_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      clearFile();
    } catch (err) {
      console.error("Extract error:", err);
      alert("Something went wrong. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Extract Images From PDF</h1>
        <p style={styles.subtitle}>Download all embedded images as a ZIP (Free + AI)</p>

        <div style={styles.uploadBox}>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            style={{ display: "none" }}
          />

          <div style={styles.fileDisplay}>
            {file ? (
              <div style={styles.fileItem}>
                <span style={styles.fileName}>{file.name}</span>
                <span style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ) : (
              <div style={styles.empty}>No file selected — click below to upload PDF.</div>
            )}
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => inputRef.current && inputRef.current.click()}
              style={styles.uploadBtn}
              disabled={loading}
            >
              Select PDF
            </button>

            <button onClick={extract} style={styles.convertBtn} disabled={loading}>
              {loading ? <Loader /> : "Extract Images (Free)"}
            </button>
          </div>

          <div style={styles.smallActions}>
            <button onClick={clearFile} style={styles.linkBtn} disabled={loading}>
              Clear
            </button>
            <a href="/" style={styles.backLink}>Back Home</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={styles.loaderWrap}>
      <div style={styles.loader}></div>
      <span style={{ marginLeft: 8 }}>Processing…</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    paddingTop: 60,
    background: "linear-gradient(180deg, #F6F5FF, #FFFFFF)",
  },
  card: {
    width: 560,
    background: "#fff",
    padding: 28,
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(79,49,120,0.08)",
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
    color: "#2a0b62",
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    color: "#6b4aa3",
    marginBottom: 18,
  },
  uploadBox: {
    marginTop: 10,
  },
  fileDisplay: {
    minHeight: 80,
    borderRadius: 12,
    border: "1px dashed #e6dfff",
    background: "#faf8ff",
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  fileItem: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  fileName: { fontWeight: 700, color: "#3b1a6a" },
  fileSize: { color: "#8a6fb8", fontSize: 12 },
  empty: { color: "#8b68b9", fontSize: 14 },
  actions: {
    display: "flex",
    gap: 12,
    marginBottom: 10,
  },
  uploadBtn: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(74,108,247,0.12)",
    background: "transparent",
    color: "#4a6cf7",
    fontWeight: 700,
    cursor: "pointer",
  },
  convertBtn: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg,#7b3cf5,#ff4db2)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  smallActions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 12,
  },
  linkBtn: {
    color: "#6b4aa3",
    textDecoration: "underline",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  backLink: {
    background: "linear-gradient(90deg,#5e2bd1,#b84bb7)",
    padding: "7px 12px",
    borderRadius: 8,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    textDecoration: "none",
  },
  loaderWrap: {
    display: "flex",
    alignItems: "center",
    color: "white",
    fontWeight: 800,
  },
  loader: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "white",
    animation: "pulse 1s infinite",
  },
};

if (typeof window !== "undefined") {
  if (!document.getElementById("extract-loader-style")) {
    const style = document.createElement("style");
    style.id = "extract-loader-style";
    style.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(0.9); opacity: 0.7; }
        50% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }
}
