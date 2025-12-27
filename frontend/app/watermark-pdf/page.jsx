"use client";

import { useState, useRef } from "react";

export default function WatermarkPdfPage() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [style, setStyle] = useState("diagonal");
  const [opacity, setOpacity] = useState(0.15);
  const [fontSize, setFontSize] = useState(48);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
  };

  const clearFiles = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const convert = async () => {
    if (!file) return alert("Please upload a PDF file");
    if (!text.trim()) return alert("Watermark text is required");

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("text", text);
      form.append("style", style);
      form.append("opacity", String(opacity)); // 0–1
      form.append("fontSize", String(fontSize));
      form.append("color", "#FF2E88"); // you can later expose picker

      const base =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

      const res = await fetch(base + "/watermark-pdf", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Conversion failed");
        alert("Conversion failed:\n\n" + txt);
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      const safeName = file.name.replace(/\.pdf$/i, "") || "watermarked";
      a.href = url;
      a.download = `${safeName}_watermarked.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      clearFiles();
    } catch (err) {
      console.error("Watermark PDF error:", err);
      alert("Something went wrong. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const prettySize = (size) => `${(size / 1024).toFixed(1)} KB`;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Watermark PDF</h1>
          <p style={styles.subtitle}>
            Add a light text watermark across all pages — perfect for drafts,
            confidential documents, or branding.
          </p>
        </div>

        <div style={styles.uploadBox}>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFiles}
            style={styles.fileInput}
          />

          <div style={styles.filesList}>
            {!file ? (
              <div style={styles.empty}>
                No file selected — click to choose or drag &amp; drop
              </div>
            ) : (
              <div style={styles.fileItem}>
                <div style={styles.thumbWrapper}>
                  <div
                    style={{
                      ...styles.thumb,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      color: "#2a0b62",
                      background: "#e2f2ff",
                    }}
                  >
                    PDF
                  </div>
                </div>
                <div style={styles.fileMeta}>
                  <div style={styles.fileName}>{file.name}</div>
                  <div style={styles.fileSize}>{prettySize(file.size)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Watermark controls */}
          <div style={styles.controlGroup}>
            <label style={styles.label}>Watermark text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={styles.input}
              placeholder="CONFIDENTIAL"
              disabled={loading}
            />
          </div>

          <div style={styles.inlineControls}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                style={styles.select}
                disabled={loading}
              >
                <option value="center">Center</option>
                <option value="diagonal">Diagonal</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={styles.label}>
                Opacity{" "}
                <span style={styles.smallNote}>
                  ({Math.round(opacity * 100)}%)
                </span>
              </label>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                style={styles.slider}
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.controlGroup}>
            <label style={styles.label}>
              Font size <span style={styles.smallNote}>({fontSize}px)</span>
            </label>
            <input
              type="range"
              min="24"
              max="96"
              step="4"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              style={styles.slider}
              disabled={loading}
            />
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => inputRef.current && inputRef.current.click()}
              style={styles.uploadBtn}
              disabled={loading}
            >
              Select File
            </button>

            <button
              onClick={convert}
              style={styles.convertBtn}
              disabled={loading || !file}
            >
              {loading ? "Applying…" : "Apply Watermark"}
            </button>
          </div>

          <div style={styles.smallActions}>
            <button
              onClick={clearFiles}
              style={styles.linkBtn}
              disabled={loading}
            >
              Clear
            </button>
            <a href="/" style={styles.backLink}>
              Back Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 48,
    background: "linear-gradient(180deg,#F6F5FF, #FFF)",
  },
  card: {
    width: 560,
    background: "#ffffff",
    padding: 28,
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(79,49,120,0.08)",
    textAlign: "left",
  },
  header: {
    marginBottom: 14,
    textAlign: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: "#2a0b62",
    margin: 0,
  },
  subtitle: {
    marginTop: 6,
    color: "#6b4aa3",
    fontSize: 13,
  },
  uploadBox: {
    marginTop: 10,
  },
  fileInput: {
    display: "none",
  },
  filesList: {
    minHeight: 140,
    borderRadius: 12,
    border: "1px dashed #e6dfff",
    display: "flex",
    flexDirection: "column",
    padding: 12,
    gap: 10,
    alignItems: "stretch",
    marginBottom: 12,
    background: "#faf8ff",
  },
  empty: {
    color: "#8b68b9",
    fontSize: 14,
    padding: 24,
    textAlign: "center",
    width: "100%",
  },
  fileItem: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    background: "#fff",
    padding: 8,
    borderRadius: 10,
    boxShadow: "0 3px 10px rgba(74,108,247,0.04)",
  },
  thumbWrapper: {
    width: 64,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3eefc",
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  fileMeta: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  fileName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#3b1a6a",
  },
  fileSize: {
    fontSize: 12,
    color: "#8a6fb8",
  },
  controlGroup: {
    marginBottom: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  inlineControls: {
    display: "flex",
    gap: 12,
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#4b3b7d",
  },
  smallNote: {
    fontSize: 11,
    color: "#8b78c2",
    fontWeight: 500,
  },
  input: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #d0c2ff",
    outline: "none",
    fontSize: 13,
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #d0c2ff",
    outline: "none",
    fontSize: 13,
    background: "#fff",
  },
  slider: {
    width: "100%",
  },
  actions: {
    display: "flex",
    gap: 12,
    marginTop: 6,
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
    background: "linear-gradient(90deg, #7b3cf5, #ff4db2)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  smallActions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 12,
    alignItems: "center",
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#6b4aa3",
    textDecoration: "underline",
    cursor: "pointer",
  },
  backLink: {
    color: "#ffffff",
    textDecoration: "none",
    background: "linear-gradient(90deg,#5e2bd1,#b84bb7)",
    padding: "6px 10px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
  },
};
