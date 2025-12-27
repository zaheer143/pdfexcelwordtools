"use client";

import { useRef, useState } from "react";

export default function BulkProtectPdf() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null); // PDF or ZIP
  const [userPassword, setUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const pick = (e) => setFile((e.target.files || [])[0] || null);

  const clear = () => {
    setFile(null);
    setUserPassword("");
    setOwnerPassword("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const protect = async () => {
    if (!file) return alert("Upload a PDF or ZIP first");
    if (!userPassword.trim()) return alert("User password is required");

    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const form = new FormData();
      form.append("file", file);
      form.append("userPassword", userPassword.trim());
      if (ownerPassword.trim()) form.append("ownerPassword", ownerPassword.trim());

      const res = await fetch(base + "/bulk-protect-pdf", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "Failed");
        alert("Failed:\n\n" + t);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk_protect_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      clear();
    } catch (err) {
      console.error("Bulk protect UI error:", err);
      alert("Something went wrong. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Bulk Protect PDF</h1>
          <p style={styles.subtitle}>
            Add password protection to PDFs (PDF or ZIP supported) — fast & private.
          </p>
        </div>

        <div style={styles.uploadBox}>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,application/zip,.zip"
            onChange={pick}
            style={styles.fileInput}
          />

          <div style={styles.filesList} onClick={() => inputRef.current?.click()}>
            {!file ? (
              <div style={styles.empty}>No file selected — click to choose or drag & drop</div>
            ) : (
              <div style={styles.fileItem}>
                <div style={styles.thumbWrapper}>
                  <div style={styles.thumb}>
                    {file.name.toLowerCase().endsWith(".zip") ? "ZIP" : "PDF"}
                  </div>
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
              <div style={styles.label}>User password (required)</div>
              <input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                style={styles.input}
                disabled={loading}
                placeholder="Enter password"
              />
            </div>
          </div>

          <div style={styles.fieldRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.label}>Owner password (optional)</div>
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                style={styles.input}
                disabled={loading}
                placeholder="If empty, user password is used"
              />
              <div style={styles.hint}>
                Owner password controls permissions. If left empty, we use the user password.
              </div>
            </div>
          </div>

          <div style={styles.tip}>
            Tip: Keep passwords safe — we don’t store your files.
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => inputRef.current?.click()}
              style={styles.uploadBtn}
              disabled={loading}
            >
              Select PDF / ZIP
            </button>

            <button
              onClick={protect}
              style={styles.convertBtn}
              disabled={loading || !file || !userPassword.trim()}
            >
              {loading ? <Loader /> : "Protect & Download ZIP"}
            </button>
          </div>

          <div style={styles.smallActions}>
            <button onClick={clear} style={styles.linkBtn} disabled={loading}>
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
      <div style={styles.loader} />
      <span style={{ marginLeft: 8 }}>Protecting...</span>
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

  empty: {
    color: "#8b68b9",
    fontSize: 14,
    padding: 28,
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

  tip: { marginTop: 10, color: "#7a5bb6", fontSize: 12 },

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

  loaderWrap: { display: "flex", alignItems: "center", color: "#fff", fontWeight: 800, fontSize: 14 },
  loader: { width: 18, height: 18, borderRadius: 18, background: "#fff", animation: "pulse 1s infinite" },
};

if (typeof window !== "undefined") {
  const styleId = "bulk-protect-loader-style";
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
