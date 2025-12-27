"use client";

import { useRef, useState } from "react";

export default function BulkRotatePdf() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [angle, setAngle] = useState(90);
  const [loading, setLoading] = useState(false);

  const pick = (e) => {
    const f = (e.target.files || [])[0];
    setFile(f || null);
  };

  const clear = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const rotate = async () => {
    if (!file) return alert("Upload a PDF or ZIP first");

    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const form = new FormData();
      form.append("file", file);
      form.append("angle", String(angle));

      const res = await fetch(base + "/bulk-rotate-pdf", { method: "POST", body: form });
      if (!res.ok) {
        const t = await res.text().catch(() => "Rotate failed");
        alert("Rotate failed:\n\n" + t);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk_rotate_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      clear();
    } catch (e) {
      console.error(e);
      alert("Something went wrong. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Bulk Rotate PDF</h1>
          <p style={styles.subtitle}>Rotate PDFs by 90°, 180°, or 270° — ZIP supported.</p>
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
              <div style={styles.label}>Rotate angle</div>
              <select value={angle} onChange={(e) => setAngle(+e.target.value)} style={styles.select} disabled={loading}>
                <option value={90}>90° clockwise</option>
                <option value={180}>180°</option>
                <option value={270}>270° clockwise</option>
              </select>
            </div>
          </div>

          <div style={styles.actions}>
            <button onClick={() => inputRef.current?.click()} style={styles.uploadBtn} disabled={loading}>
              Select PDF / ZIP
            </button>
            <button onClick={rotate} style={styles.convertBtn} disabled={loading || !file}>
              {loading ? <Loader /> : "Rotate & Download ZIP"}
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
      <span style={{ marginLeft: 8 }}>Rotating...</span>
    </div>
  );
}

// (styles object identical to your previous tools — omitted for brevity if you reuse it)
// If you want, say “paste styles” and I’ll inline the exact same styles block again.
const styles = {
  page:{minHeight:"100vh",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:48,background:"linear-gradient(180deg,#F6F5FF,#FFF)"},
  card:{width:620,background:"#fff",padding:28,borderRadius:18,boxShadow:"0 10px 30px rgba(79,49,120,0.08)"},
  header:{textAlign:"center",marginBottom:14},
  title:{fontSize:26,fontWeight:800,color:"#2a0b62",margin:0},
  subtitle:{marginTop:6,color:"#6b4aa3",fontSize:13},
  uploadBox:{marginTop:10},
  fileInput:{display:"none"},
  filesList:{minHeight:160,borderRadius:12,border:"1px dashed #e6dfff",padding:12,background:"#faf8ff",cursor:"pointer"},
  empty:{color:"#8b68b9",fontSize:14,padding:28,textAlign:"center"},
  fileItem:{display:"flex",gap:12,alignItems:"center",background:"#fff",padding:8,borderRadius:10},
  thumbWrapper:{width:64,height:48,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",background:"#f3eefc"},
  thumb:{fontWeight:900,color:"#2a0b62"},
  fileMeta:{display:"flex",flexDirection:"column"},
  fileName:{fontSize:13,fontWeight:700,color:"#3b1a6a"},
  fileSize:{fontSize:12,color:"#8a6fb8"},
  fieldRow:{display:"flex",gap:12,marginTop:8},
  label:{fontSize:12,fontWeight:700,color:"#4b3b7d",marginBottom:6},
  select:{width:"100%",padding:"10px 12px",borderRadius:12,border:"1px solid #d0c2ff"},
  actions:{display:"flex",gap:12,marginTop:14},
  uploadBtn:{flex:1,padding:"12px 14px",borderRadius:12,border:"1px solid rgba(74,108,247,0.12)",background:"transparent",color:"#4a6cf7",fontWeight:700},
  convertBtn:{flex:1,padding:"12px 14px",borderRadius:12,border:"none",background:"linear-gradient(90deg,#7b3cf5,#ff4db2)",color:"#fff",fontWeight:800},
  smallActions:{display:"flex",justifyContent:"space-between",marginTop:12},
  linkBtn:{background:"transparent",border:"none",color:"#6b4aa3",textDecoration:"underline"},
  backLink:{color:"#fff",textDecoration:"none",background:"linear-gradient(90deg,#5e2bd1,#b84bb7)",padding:"6px 10px",borderRadius:8,fontWeight:700,fontSize:13},
  loaderWrap:{display:"flex",alignItems:"center",color:"#fff",fontWeight:800},
  loader:{width:18,height:18,borderRadius:18,background:"#fff",animation:"pulse 1s infinite"}
};
