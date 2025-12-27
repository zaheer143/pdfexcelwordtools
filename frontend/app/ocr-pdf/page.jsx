"use client";
import { useRef, useState } from "react";

export default function OcrPdf() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [lang, setLang] = useState("eng");
  const [optimize, setOptimize] = useState("1");
  const [deskew, setDeskew] = useState(true);
  const [rotate, setRotate] = useState(true);
  const [loading, setLoading] = useState(false);

  const clear = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const convert = async () => {
    if (!file) return alert("Upload a PDF");

    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const form = new FormData();
      form.append("file", file);
      form.append("lang", lang);
      form.append("optimize", optimize);
      form.append("deskew", String(deskew));
      form.append("rotate", String(rotate));

      const res = await fetch(base + "/ocr-pdf", { method: "POST", body: form });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Failed");
        alert("OCR failed:\n\n" + txt);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.pdf$/i, "")}_searchable.pdf`;
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
          <h1 style={styles.title}>OCR PDF</h1>
          <p style={styles.subtitle}>Convert scanned PDFs into searchable PDFs — fast & private.</p>
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
          <div style={styles.label}>Language</div>
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={styles.select} disabled={loading}>
            <option value="eng">English (eng)</option>
            <option value="hin">Hindi (hin)</option>
            <option value="tam">Tamil (tam)</option>
            <option value="tel">Telugu (tel)</option>
            <option value="kan">Kannada (kan)</option>
            <option value="mal">Malayalam (mal)</option>
          </select>
          <div style={styles.help}>Tip: For mixed text, use English first. Multi-lang support can be added later.</div>
        </div>

        <div style={styles.grid2}>
          <div style={styles.field}>
            <div style={styles.label}>Optimize (0–3)</div>
            <select value={optimize} onChange={(e) => setOptimize(e.target.value)} style={styles.select} disabled={loading}>
              <option value="0">0 (best quality, larger)</option>
              <option value="1">1 (recommended)</option>
              <option value="2">2 (smaller, slower)</option>
              <option value="3">3 (smallest, slowest)</option>
            </select>
          </div>

          <div style={styles.field}>
            <div style={styles.label}>Options</div>
            <label style={styles.checkRow}>
              <input type="checkbox" checked={deskew} onChange={(e) => setDeskew(e.target.checked)} disabled={loading} />
              <span>Deskew</span>
            </label>
            <label style={styles.checkRow}>
              <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} disabled={loading} />
              <span>Auto-rotate pages</span>
            </label>
          </div>
        </div>

        <div style={styles.actions}>
          <button onClick={() => inputRef.current?.click()} style={styles.uploadBtn} disabled={loading}>
            Select PDF
          </button>
          <button onClick={convert} style={styles.convertBtn} disabled={loading || !file}>
            {loading ? "Working…" : "Make Searchable PDF"}
          </button>
        </div>

        <div style={styles.smallActions}>
          <button onClick={clear} style={styles.linkBtn} disabled={loading}>Clear</button>
          <a href="/" style={styles.backLink}>Back Home</a>
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

  filesList: { minHeight: 120, borderRadius: 12, border: "1px dashed #e6dfff", padding: 12, background: "#faf8ff", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 },
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
  help: { fontSize: 12, color: "#8a6fb8" },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 },

  checkRow: { display: "flex", gap: 8, alignItems: "center", color: "#3b1a6a", fontWeight: 600 },

  actions: { display: "flex", gap: 12, marginTop: 14 },
  uploadBtn: { flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(74,108,247,0.12)", background: "transparent", color: "#4a6cf7", fontWeight: 700, cursor: "pointer" },
  convertBtn: { flex: 1, padding: "12px 14px", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#7b3cf5,#ff4db2)", color: "#fff", fontWeight: 800, cursor: "pointer" },

  smallActions: { display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
  linkBtn: { background: "transparent", border: "none", color: "#6b4aa3", textDecoration: "underline", cursor: "pointer" },
  backLink: { color: "#fff", textDecoration: "none", background: "linear-gradient(90deg,#5e2bd1,#b84bb7)", padding: "6px 10px", borderRadius: 8, fontWeight: 700, fontSize: 13 },
};
