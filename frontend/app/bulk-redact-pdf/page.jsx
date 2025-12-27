"use client";

import { useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

export default function BulkRedactPdf() {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const pick = () => fileRef.current?.click();

  const onPick = (e) => {
    const list = Array.from(e.target.files || []).filter((f) => /\.pdf$/i.test(f.name));
    setFiles(list);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files || []).filter((f) => /\.pdf$/i.test(f.name));
    if (list.length) setFiles(list);
  };

  const clear = () => {
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = async () => {
    if (!files.length) return alert("Upload PDFs first");
    setLoading(true);

    try {
      const form = new FormData();
      files.forEach((f) => form.append("pdfs", f));

      const res = await fetch(`${API}/bulk-redact-pdf`, {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Server error (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "redacted_pdfs.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || "Redaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap">
      <div className="card">
        <h1 className="title">PDF Redact</h1>
        <p className="sub">
          Auto-detects Email / Phone / PAN / Aadhaar and permanently redacts (ZIP output) — fast & private.
        </p>

        <div
          className="drop"
          onClick={pick}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={onPick}
          />
          <div className="dropText">
            {files.length ? (
              <span>
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </span>
            ) : (
              <span>No file selected — click to choose or drag & drop</span>
            )}
          </div>
        </div>

        <div className="fileList">
          {files.map((f) => (
            <div key={f.name} className="fileRow">
              <span className="fileName">{f.name}</span>
              <span className="fileSize">{Math.ceil(f.size / 1024)} KB</span>
            </div>
          ))}
        </div>

        <div className="actions">
          <button className="btnGhost" onClick={pick} disabled={loading}>
            Select PDF
          </button>

          <button className="btnMain" onClick={run} disabled={loading || !files.length}>
            {loading ? "Processing..." : "Redact & Download ZIP"}
          </button>
        </div>

        <div className="bottomRow">
          <button className="link" onClick={clear} disabled={loading}>
            Clear
          </button>

          <a className="back" href="/">
            Back Home
          </a>
        </div>

        <p className="tip">
          Tip: If a PDF can’t be processed, the ZIP will include an <b>_ERROR.txt</b> explaining why.
        </p>
      </div>

      <style jsx>{`
        .wrap{
          min-height:100vh;
          display:flex;
          align-items:flex-start;
          justify-content:center;
          padding:40px 16px;
          background: radial-gradient(1100px 600px at 20% 10%, #f3e9ff 0%, transparent 60%),
                      radial-gradient(900px 500px at 85% 20%, #ffe8f6 0%, transparent 55%),
                      #f7f8ff;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
          color:#1b1b2a;
        }
        .card{
          width: min(900px, 100%);
          background:#fff;
          border-radius:18px;
          box-shadow: 0 18px 60px rgba(16,24,40,0.12);
          padding:28px 28px 22px;
        }
        .title{
          margin:0;
          text-align:center;
          font-size:32px;
          font-weight:800;
          color:#2b1466;
          letter-spacing:0.2px;
          font-family: Georgia, "Times New Roman", serif;
        }
        .sub{
          margin:10px 0 18px;
          text-align:center;
          color:#5a5a7a;
          font-size:14px;
        }
        .drop{
          border:2px dashed rgba(126, 87, 194, 0.35);
          background:#faf7ff;
          border-radius:14px;
          height:170px;
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          user-select:none;
        }
        .dropText{
          color:#6a4bc7;
          font-size:14px;
        }
        .fileList{ margin-top:12px; display:grid; gap:8px; }
        .fileRow{
          display:flex;
          justify-content:space-between;
          align-items:center;
          border:1px solid rgba(126,87,194,0.18);
          background:#fbfbff;
          border-radius:12px;
          padding:10px 12px;
        }
        .fileName{ max-width:75%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .fileSize{ color:#6f6f8a; font-size:12px; }

        .actions{
          display:flex;
          gap:14px;
          margin-top:18px;
          align-items:center;
          justify-content:center;
        }
        .btnGhost{
          min-width:260px;
          padding:14px 16px;
          border-radius:14px;
          border:1px solid rgba(126,87,194,0.22);
          background:#fff;
          color:#5f39c7;
          font-weight:700;
          cursor:pointer;
        }
        .btnMain{
          min-width:300px;
          padding:14px 16px;
          border-radius:14px;
          border:none;
          background: linear-gradient(90deg, #7c3aed 0%, #ff4fb5 100%);
          color:#fff;
          font-weight:800;
          cursor:pointer;
          box-shadow: 0 10px 30px rgba(124,58,237,0.18);
        }
        .btnMain:disabled, .btnGhost:disabled{ opacity:0.6; cursor:not-allowed; }

        .bottomRow{
          margin-top:16px;
          display:flex;
          justify-content:space-between;
          align-items:center;
        }
        .link{
          background:none;
          border:none;
          padding:0;
          color:#6a4bc7;
          text-decoration:underline;
          cursor:pointer;
          font-weight:600;
        }
        .back{
          display:inline-block;
          padding:8px 14px;
          border-radius:12px;
          background:#6a3be6;
          color:#fff;
          font-weight:700;
        }
        .tip{
          margin:12px 0 0;
          color:#6f6f8a;
          font-size:12px;
          text-align:left;
        }
      `}</style>
    </div>
  );
}
