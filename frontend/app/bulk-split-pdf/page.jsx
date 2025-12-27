"use client";

import { useRef, useState } from "react";

export default function BulkSplitPdf() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null); // PDF or ZIP
  const [everyN, setEveryN] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const f = (e.target.files || [])[0];
    setFile(f || null);
  };

  const clear = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const split = async () => {
    if (!file) return alert("Upload a PDF or ZIP first");

    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

      const form = new FormData();
      form.append("file", file); // ✅ IMPORTANT
      form.append("everyN", String(everyN));

      const res = await fetch(base + "/bulk-split-pdf", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Split failed");
        alert("Split failed:\n\n" + txt);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk_split_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      clear();
    } catch (err) {
      console.error("Bulk split error:", err);
      alert("Something went wrong. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Bulk Split PDF</h1>
          <p style={styles.subtitle}>
            Upload a PDF or a ZIP of PDFs, split into parts, and download a ZIP — fast & private.
          </p>
        </div>

        <div style={styles.uploadBox}>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,application/zip,.zip"
            onChange={handleFile}
            style={styles.fileInput}
          />

          <div style={styles.filesList} onClick={() => inputRef.current?.click()}>
            {!file ? (
              <div style={styles.empty}>No file selected — click to choose or drag & drop</div>
            ) : (
              <div style={styles.fileItem}>
                <div style={styles.thumbWrapper}>
                  <div style={styles.thumb}>{file.name.toLowerCase().endsWith(".zip") ? "ZIP" : "PDF"}</div>
                </div>
                <div style={styles.fileMeta}>
                  <div style={styles.fileName}>{file.name}</div>
                  <div style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            )}
          </div>

          <div style={styles.fieldRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.label}>Pages per part</div>
              <input
                type="number"
                min="1"
                value={everyN}
                onChange={(e) => setEveryN(e.target.value)}
                style={styles.input}
                disabled={loading}
              />
              <div style={styles.hint}>Example: N=5 splits a 30-page PDF into 6 parts.</div>
            </div>
          </div>

          <div style={styles.actions}>
            <button onClick={() => inputRef.current?.click()} style={styles.uploadBtn} disabled={loading}>
              Select PDF / ZIP
            </button>

            <button onClick={split} style={styles.convertBtn} disabled={loading || !file}>
              {loading ? <Loader /> : "Split & Download ZIP"}
            </button>
          </div>

          <div style={styles.smallActions}>
            <button onClick={clear} style={styles.linkBtn} disabled={loading}>Clear</button>
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
      <div style={styles.loader} />
      <span style={{ marginLeft: 8 }}>Splitting...</span>
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
    width: 620,
    background: "#ffffff",
    padding: 28,
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(79,49,120,0.08)",
    textAlign: "left",
  },
  header: { marginBottom: 14, textAlign: "center" },
  title: { fontSize: 26, fontWeight: 800, color: "#2a0b62", margin: 0 },
  subtitle: { marginTop: 6, color: "#6b4aa3", fontSize: 13 },

  uploadBox: { marginTop: 10 },
  fileInput: { display: "none" },

  filesList: {
    minHeight: 160,
    borderRadius: 12,
    border: "1px dashed #e6dfff",
    display: "flex",
    flexDirection: "column",
    padding: 12,
    gap: 10,
    alignItems: "stretch",
    marginBottom: 12,
    background: "#faf8ff",
    cursor: "pointer",
  },
  empty: { color: "#8b68b9", fontSize: 14, padding: 28, textAlign: "center", width: "100%" },

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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: "#2a0b62",
    background: "#e2f2ff",
    borderRadius: 8,
  },
  fileMeta: { display: "flex", flexDirection: "column" },
  fileName: { fontSize: 13, fontWeight: 700, color: "#3b1a6a" },
  fileSize: { fontSize: 12, color: "#8a6fb8" },

  fieldRow: { display: "flex", gap: 12, marginTop: 8, alignItems: "end" },
  label: { fontSize: 12, fontWeight: 700, color: "#4b3b7d", marginBottom: 6 },
  hint: { marginTop: 6, fontSize: 12, color: "#7a5bb6" },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d0c2ff",
    outline: "none",
    fontSize: 13,
    background: "#fff",
  },

  actions: { display: "flex", gap: 12, marginTop: 14 },
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
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  smallActions: { display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
  linkBtn: { background: "transparent", border: "none", color: "#6b4aa3", textDecoration: "underline", cursor: "pointer" },
  backLink: {
    color: "#ffffff",
    textDecoration: "none",
    background: "linear-gradient(90deg,#5e2bd1,#b84bb7)",
    padding: "6px 10px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
  },

  loaderWrap: { display: "flex", alignItems: "center", color: "#fff", fontWeight: 800, fontSize: 14 },
  loader: { width: 18, height: 18, borderRadius: 18, background: "#fff", boxShadow: "0 0 0 0 rgba(255,255,255,0.35)", animation: "pulse 1s infinite" },
};

if (typeof window !== "undefined") {
  const styleId = "bulk-split-loader-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
        70% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 0 8px rgba(255,255,255,0); }
        100% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
      }
    `;
    document.head.appendChild(s);
  }
}
