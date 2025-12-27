"use client";

import { useRef, useState } from "react";

export default function RemovePages() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("1");
  const [loading, setLoading] = useState(false);

  const clear = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const convert = async () => {
    if (!file) return alert("Upload a PDF");
    if (!pages.trim()) return alert("Enter pages to remove (e.g., 1,3-5)");

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("pages", pages);

      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(base + "/remove-pages", { method: "POST", body: form });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Failed");
        alert("Failed:\n\n" + txt);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.pdf$/i, "")}_removed_pages.pdf`;
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
          <h1 style={styles.title}>Remove Pages</h1>
          <p style={styles.subtitle}>Delete specific pages like 1,3-5,9 — fast & private.</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={styles.fileInput}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
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

        <div style={styles.controlGroup}>
          <label style={styles.label}>Pages to remove</label>
          <input
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            style={styles.input}
            placeholder="Example: 1,3-5,9"
            disabled={loading}
          />
          <div style={styles.hint}>Tip: Use commas + ranges. Example: <b>2,4-7</b></div>
        </div>

        <div style={styles.actions}>
          <button
            style={styles.uploadBtn}
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            Select PDF
          </button>
          <button style={styles.convertBtn} onClick={convert} disabled={!file || loading}>
            {loading ? "Removing…" : "Remove Pages"}
          </button>
        </div>

        <div style={styles.smallActions}>
          <button style={styles.linkBtn} onClick={clear} disabled={loading}>Clear</button>
          <a href="/" style={styles.backLink}>Back Home</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", justifyContent: "center", paddingTop: 48, background: "linear-gradient(180deg,#F6F5FF, #FFF)" },
  card: { width: 560, background: "#fff", padding: 28, borderRadius: 18, boxShadow: "0 10px 30px rgba(79,49,120,0.08)" },
  header: { textAlign: "center", marginBottom: 14 },
  title: { fontSize: 26, fontWeight: 800, color: "#2a0b62", margin: 0 },
  subtitle: { marginTop: 6, color: "#6b4aa3", fontSize: 13 },
  fileInput: { display: "none" },
  filesList: { minHeight: 140, borderRadius: 12, border: "1px dashed #e6dfff", padding: 12, background: "#faf8ff", marginBottom: 12 },
  empty: { color: "#8b68b9", fontSize: 14, padding: 24, textAlign: "center" },
  fileItem: { display: "flex", gap: 12, alignItems: "center", background: "#fff", padding: 8, borderRadius: 10, boxShadow: "0 3px 10px rgba(74,108,247,0.04)" },
  thumbWrapper: { width: 64, height: 48, borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3eefc" },
  thumb: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#2a0b62", background: "#e2f2ff" },
  fileMeta: { display: "flex", flexDirection: "column" },
  fileName: { fontSize: 13, fontWeight: 700, color: "#3b1a6a" },
  fileSize: { fontSize: 12, color: "#8a6fb8" },
  controlGroup: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#4b3b7d" },
  input: { padding: "10px 12px", borderRadius: 12, border: "1px solid #d0c2ff", outline: "none", fontSize: 13 },
  hint: { fontSize: 12, color: "#8b78c2" },
  actions: { display: "flex", gap: 12, marginTop: 6 },
  uploadBtn: { flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(74,108,247,0.12)", background: "transparent", color: "#4a6cf7", fontWeight: 700, cursor: "pointer" },
  convertBtn: { flex: 1, padding: "12px 14px", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#7b3cf5,#ff4db2)", color: "#fff", fontWeight: 800, cursor: "pointer" },
  smallActions: { display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
  linkBtn: { background: "transparent", border: "none", color: "#6b4aa3", textDecoration: "underline", cursor: "pointer" },
  backLink: { color: "#fff", textDecoration: "none", background: "linear-gradient(90deg,#5e2bd1,#b84bb7)", padding: "6px 10px", borderRadius: 8, fontWeight: 700, fontSize: 13 },
};
