"use client";

import { useState, useRef } from "react";

export default function JpgToPdf() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
  };

  const clearFiles = () => {
    setImages([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const convert = async () => {
    if (images.length === 0) return alert("Upload at least one image");

    setLoading(true);

    try {
      const form = new FormData();
      images.forEach((img) => form.append("images", img));

      const res = await fetch("http://localhost:3001/jpg-to-pdf", {
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
      a.href = url;
      a.download = `images_to_pdf_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // keep input for user convenience
      clearFiles();
    } catch (err) {
      console.error("JPG→PDF error:", err);
      alert("Something went wrong. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>JPG → PDF</h1>
          <p style={styles.subtitle}>Convert multiple images into a single PDF — fast & private.</p>
        </div>

        <div style={styles.uploadBox}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            style={styles.fileInput}
          />

          <div style={styles.filesList}>
            {images.length === 0 ? (
              <div style={styles.empty}>No images selected — click to choose or drag & drop</div>
            ) : (
              images.map((f, i) => (
                <div key={i} style={styles.fileItem}>
                  <div style={styles.thumbWrapper}>
                    {f.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        style={styles.thumb}
                        onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                      />
                    ) : (
                      <div style={styles.thumb}>IMG</div>
                    )}
                  </div>
                  <div style={styles.fileMeta}>
                    <div style={styles.fileName}>{f.name}</div>
                    <div style={styles.fileSize}>{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => inputRef.current && inputRef.current.click()}
              style={styles.uploadBtn}
              disabled={loading}
            >
              Select Images
            </button>

            <button onClick={convert} style={styles.convertBtn} disabled={loading}>
              {loading ? <Loader /> : "Convert to PDF"}
            </button>
          </div>

          <div style={styles.smallActions}>
            <button onClick={clearFiles} style={styles.linkBtn} disabled={loading}>
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
      <span style={{ marginLeft: 8 }}>Converting...</span>
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
    background: "linear-gradient(180deg,#F6F5FF, #FFF)", // subtle background
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

  actions: {
    display: "flex",
    gap: 12,
    marginTop: 14,
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

  loaderWrap: {
    display: "flex",
    alignItems: "center",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
  },

  loader: {
    width: 18,
    height: 18,
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 0 0 0 rgba(255,255,255,0.35)",
    animation: "pulse 1s infinite",
  },

  // keyframes added below in a tiny style block via pseudo-element approach
};

// inject keyframes into the document (works in Next.js client component)
if (typeof window !== "undefined") {
  const styleId = "jpg-to-pdf-loader-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
        70% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 0 8px rgba(255,255,255,0); }
        100% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(255,255,255,0); }
      }
    `;
    document.head.appendChild(s);
  }
}
