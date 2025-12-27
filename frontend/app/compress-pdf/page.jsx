"use client";

import { useRef, useState } from "react";

export default function CompressPdf() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("recommended"); // extreme / recommended / low
  const [loading, setLoading] = useState(false);

  const clear = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const convert = async () => {
    if (!file) return alert("Upload a PDF");

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);

      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(base + "/compress-pdf", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Failed");
        alert("Compression failed:\n\n" + txt);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.pdf$/i, "")}_compressed.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      clear();
    } catch (e) {
      console.error(e);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Compress PDF</h1>
          <p style={styles.subtitle}>Reduce PDF file size with quality control — iLovePDF-style.</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={styles.fileInput}
        />

        <div style={styles.filesList}>
          {!file ? (
            <div style={styles.empty}>No PDF selected — click Select PDF</div>
          ) : (
            <div style={styles.fileItem}>
              <div style={styles.thumbWrapper}><div style={styles.thumb}>PDF</div></div>
              <div style={styles.fileMeta}>
                <div style={styles.fileName}>{file.name}</div>
                <div style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
          )}
        </div>

        <div style={styles.field}>
          <div style={styles.label}>Compression Level</div>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.select} disabled={loading}>
            <option value="extreme">Extreme (smallest size)</option>
            <option value="recommended">Recommended (best balance)</option>
            <option value="low">Low (best quality)</option>
          </select>
        </div>

        <div style={styles.actions}>
          <button onClick={() => inputRef.current?.click()} style={styles.uploadBtn} disabled={loading}>
            Select PDF
          </button>
          <button onClick={convert} style={styles.convertBtn} disabled={loading || !file}>
            {loading ? "Compressing…" : "Compress PDF"}
          </button>
        </div>

        <div style={styles.smallActions}>
          <button onClick={clear} style={styles.linkBtn} disabled={loading}>Clear</button>
          <a href="/" style={styles.backLink}>Back Home</a>
        </div>

        <div style={styles.note}>
          This tool uses Ghostscript on the backend. Make sure Ghostscript is installed (local / Railway).
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", justifyContent: "center", paddingTop: 48, background: "linear-gradient(180deg,#F6F5FF,#FFF)" },
  card: { width: 560, background: "#fff", padding: 28, borderRadius: 18, boxShadow: "0 10px 30px rgba(79,49,120,0.08)" },
  header: { textAlign: "center", marginBottom: 14 },
  title: { fontSize: 26, fontWeight: 800, color: "#2a0b62", margin: 0 },
  subtitle: { marginTop: 6, color: "#6b4aa3", fontSize: 13 },

  fileInput: { display: "none" },

  filesList: { minHeight: 140, borderRadius: 12, border: "1px dashed #e6dfff", padding: 12, background: "#faf8ff", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 },
  empty: { color: "#8b68b9", fontSize: 14, padding: 24, textAlign: "center" },

  fileItem: { display: "flex", gap: 12, alignItems: "center", background: "#fff", padding: 8, borderRadius: 10, boxShadow: "0 3px 10px rgba(74,108,247,0.04)" },
  thumbWrapper: { width: 64, height: 48, borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3eefc" },
  thumb: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#2a0b62", background: "#e2f2ff", borderRadius: 8 },
  fileMeta: { display: "flex", flexDirection: "column" },
  fileName: { fontSize: 13, fontWeight: 700, color: "#3b1a6a" },
  fileSize: { fontSize: 12, color: "#8a6fb8" },

  field: { display: "flex", flexDirection: "column", gap: 6, marginTop: 10 },
  label: { fontSize: 12, fontWeight: 700, color: "#4b3b7d" },
  select: { padding: "10px 12px", borderRadius: 12, border: "1px solid #d0c2ff", outline: "none", fontSize: 13, background: "#fff" },

  actions: { display: "flex", gap: 12, marginTop: 14 },
  uploadBtn: { flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(74,108,247,0.12)", background: "transparent", color: "#4a6cf7", fontWeight: 700, cursor: "pointer" },
  convertBtn: { flex: 1, padding: "12px 14px", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#7b3cf5,#ff4db2)", color: "#fff", fontWeight: 800, cursor: "pointer" },

  smallActions: { display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
  linkBtn: { background: "transparent", border: "none", color: "#6b4aa3", textDecoration: "underline", cursor: "pointer" },
  backLink: { color: "#fff", textDecoration: "none", background: "linear-gradient(90deg,#5e2bd1,#b84bb7)", padding: "6px 10px", borderRadius: 8, fontWeight: 700, fontSize: 13 },

  note: { marginTop: 12, fontSize: 12, color: "#7a66a8", background: "#faf8ff", border: "1px solid #e6dfff", padding: 10, borderRadius: 12 },
};
