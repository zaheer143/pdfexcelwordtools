"use client";

import { useEffect, useMemo, useRef, useState } from "react";

async function loadPdfjs() {
  // ✅ Next.js safe ESM import
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjs = mod?.default || mod;

  // ✅ worker served from /public
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  return pdfjs;
}

// canvas coords -> PDF coords (PDF origin bottom-left)
function canvasToPdf({ cx, cy, scale, pageHeight }) {
  return { x: cx / scale, y: pageHeight - cy / scale };
}

// PDF coords -> canvas coords
function pdfToCanvas({ x, y, scale, pageHeight }) {
  return { cx: x * scale, cy: (pageHeight - y) * scale };
}

export default function TypeOnPdf() {
  const fileRef = useRef(null);
  const canvasRef = useRef(null);

  const [file, setFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageInfo, setPageInfo] = useState(null); // {pdfWidth, pdfHeight, scale, canvasWidth, canvasHeight}
  const [rendering, setRendering] = useState(false);

  const [activeId, setActiveId] = useState(null);

  // overlays: {id, pageIndex, x,y (PDF units), text,size,color,opacity,rotate,bold}
  const [overlays, setOverlays] = useState([]);

  const visibleOverlays = useMemo(
    () => overlays.filter((o) => o.pageIndex === pageIndex),
    [overlays, pageIndex]
  );

  const clear = () => {
    setFile(null);
    setPdfDoc(null);
    setPageIndex(0);
    setPageInfo(null);
    setOverlays([]);
    setActiveId(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // 1) Load PDF into pdf.js
  useEffect(() => {
    (async () => {
      if (!file) return;

      setRendering(true);
      try {
        const pdfjs = await loadPdfjs();
        const ab = await file.arrayBuffer();
        const uint8 = new Uint8Array(ab); // ✅ required

        const doc = await pdfjs.getDocument({ data: uint8 }).promise;

        setPdfDoc(doc);
        setPageIndex(0);
      } catch (e) {
        console.error("PDF load error:", e);
        alert("Failed to load PDF. Check console for details.");
        clear();
      } finally {
        setRendering(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // 2) Render current page onto canvas
  useEffect(() => {
    (async () => {
      if (!pdfDoc) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);

        // Fit to ~820px wide
        const viewportBase = page.getViewport({ scale: 1 });
        const targetWidth = 820;
        const scale = Math.min(1.7, Math.max(0.6, targetWidth / viewportBase.width));
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        setPageInfo({
          pdfWidth: viewportBase.width,
          pdfHeight: viewportBase.height,
          scale,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        });
      } catch (e) {
        console.error("PDF render error:", e);
        alert("Failed to render PDF page. Check console.");
      } finally {
        setRendering(false);
      }
    })();
  }, [pdfDoc, pageIndex]);

  const addTextAt = (cx, cy) => {
    if (!pageInfo) return;

    const { x, y } = canvasToPdf({
      cx,
      cy,
      scale: pageInfo.scale,
      pageHeight: pageInfo.pdfHeight,
    });

    const id = crypto.randomUUID();
    const newItem = {
      id,
      pageIndex,
      x,
      y,
      text: "Type here",
      size: 18,
      color: "#111111",
      opacity: 1,
      rotate: 0,
      bold: false,
    };

    setOverlays((prev) => [...prev, newItem]);
    setActiveId(id);
  };

  const hitTest = (cx, cy) => {
    if (!pageInfo) return null;

    // check latest first
    for (let i = visibleOverlays.length - 1; i >= 0; i--) {
      const o = visibleOverlays[i];

      const { cx: ox, cy: oy } = pdfToCanvas({
        x: o.x,
        y: o.y,
        scale: pageInfo.scale,
        pageHeight: pageInfo.pdfHeight,
      });

      const w = Math.max(70, (o.text?.length || 1) * (o.size * 0.55) * pageInfo.scale);
      const h = Math.max(24, o.size * 1.3 * pageInfo.scale);

      // overlay box is top-aligned (we translate -100% in render)
      const top = oy;
      const left = ox;

      if (cx >= left && cx <= left + w && cy >= top - h && cy <= top) {
        return o;
      }
    }
    return null;
  };

  const onCanvasClick = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const hit = hitTest(cx, cy);
    if (hit) {
      setActiveId(hit.id);
      return;
    }

    addTextAt(cx, cy);
  };

  // Drag
  const dragRef = useRef({ dragging: false, id: null, dx: 0, dy: 0 });

  const onMouseDownOverlay = (e, id) => {
    e.stopPropagation();
    if (!pageInfo || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const o = overlays.find((x) => x.id === id);
    if (!o) return;

    const { cx: ox, cy: oy } = pdfToCanvas({
      x: o.x,
      y: o.y,
      scale: pageInfo.scale,
      pageHeight: pageInfo.pdfHeight,
    });

    dragRef.current = { dragging: true, id, dx: cx - ox, dy: cy - oy };
    setActiveId(id);
  };

  const onMouseMove = (e) => {
    if (!dragRef.current.dragging || !pageInfo || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const id = dragRef.current.id;

    const nx = cx - dragRef.current.dx;
    const ny = cy - dragRef.current.dy;

    const { x, y } = canvasToPdf({
      cx: nx,
      cy: ny,
      scale: pageInfo.scale,
      pageHeight: pageInfo.pdfHeight,
    });

    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, x, y } : o)));
  };

  const onMouseUp = () => {
    dragRef.current = { dragging: false, id: null, dx: 0, dy: 0 };
  };

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageInfo, overlays]);

  const active = overlays.find((o) => o.id === activeId) || null;

  const updateActive = (patch) => {
    if (!active) return;
    setOverlays((prev) => prev.map((o) => (o.id === active.id ? { ...o, ...patch } : o)));
  };

  const removeActive = () => {
    if (!active) return;
    setOverlays((prev) => prev.filter((o) => o.id !== active.id));
    setActiveId(null);
  };

  const download = async () => {
    if (!file) return alert("Upload PDF first");

    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const form = new FormData();
      form.append("file", file);
      form.append("annotations", JSON.stringify(overlays));

      const res = await fetch(base + "/type-on-pdf", { method: "POST", body: form });
      if (!res.ok) {
        const txt = await res.text().catch(() => "Failed");
        alert("Failed:\n\n" + txt);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.pdf$/i, "")}_typed.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download error:", e);
      alert("Download failed. Check console.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, width: 980 }}>
        <div style={styles.header}>
          <h1 style={styles.title}>Type on PDF</h1>
          <p style={styles.subtitle}>Click to add text • Drag to move • Download final PDF</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={styles.fileInput}
        />

        <div style={styles.topActions}>
          <button onClick={() => fileRef.current?.click()} style={styles.uploadBtn} disabled={rendering}>
            Select PDF
          </button>

          <button onClick={download} style={styles.convertBtn} disabled={!file || rendering}>
            {rendering ? "Working…" : "Download PDF"}
          </button>

          <button onClick={clear} style={styles.linkBtn} disabled={rendering}>
            Clear
          </button>

          <a href="/" style={styles.backLink}>Back Home</a>
        </div>

        {!file ? (
          <div style={styles.emptyBox}>Upload a PDF to start.</div>
        ) : (
          <div style={styles.layout}>
            <div style={styles.viewer}>
              <div style={styles.nav}>
                <button
                  style={styles.navBtn}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  disabled={!pdfDoc || pageIndex === 0 || rendering}
                >
                  ◀ Prev
                </button>

                <div style={styles.navText}>
                  Page {pageIndex + 1} / {pdfDoc?.numPages || 0}
                </div>

                <button
                  style={styles.navBtn}
                  onClick={() => setPageIndex((p) => Math.min((pdfDoc?.numPages || 1) - 1, p + 1))}
                  disabled={!pdfDoc || pageIndex >= (pdfDoc?.numPages || 1) - 1 || rendering}
                >
                  Next ▶
                </button>
              </div>

              <div style={styles.canvasWrap} onClick={onCanvasClick}>
                <canvas ref={canvasRef} style={styles.canvas} />

                {/* overlays */}
                {pageInfo &&
                  visibleOverlays.map((o) => {
                    const { cx, cy } = pdfToCanvas({
                      x: o.x,
                      y: o.y,
                      scale: pageInfo.scale,
                      pageHeight: pageInfo.pdfHeight,
                    });

                    const isActive = o.id === activeId;

                    return (
                      <div
                        key={o.id}
                        onMouseDown={(e) => onMouseDownOverlay(e, o.id)}
                        style={{
                          ...styles.overlayBox,
                          left: cx,
                          top: cy,
                          transform: `translate(0, -100%) rotate(${o.rotate}deg)`,
                          opacity: o.opacity,
                          border: isActive
                            ? "2px solid #7b3cf5"
                            : "1px dashed rgba(123,60,245,0.35)",
                          fontSize: o.size * pageInfo.scale,
                          color: o.color,
                          fontWeight: o.bold ? 800 : 600,
                        }}
                        title="Drag to move"
                      >
                        {o.text}
                      </div>
                    );
                  })}
              </div>

              <div style={styles.tip}>
                Tip: Click anywhere to add text. Drag text to reposition.
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelTitle}>Text Settings</div>

              {!active ? (
                <div style={styles.panelEmpty}>Select a text box to edit.</div>
              ) : (
                <>
                  <div style={styles.field}>
                    <div style={styles.label}>Text</div>
                    <textarea
                      value={active.text}
                      onChange={(e) => updateActive({ text: e.target.value })}
                      style={{ ...styles.input, height: 90, resize: "vertical" }}
                    />
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <div style={styles.label}>Font Size</div>
                      <input
                        type="number"
                        min="6"
                        max="200"
                        value={active.size}
                        onChange={(e) => updateActive({ size: Number(e.target.value || 18) })}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Color</div>
                      <input
                        type="color"
                        value={active.color}
                        onChange={(e) => updateActive({ color: e.target.value })}
                        style={{ height: 40 }}
                      />
                    </div>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <div style={styles.label}>Opacity ({active.opacity})</div>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.01"
                        value={active.opacity}
                        onChange={(e) => updateActive({ opacity: Number(e.target.value) })}
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Rotate ({active.rotate}°)</div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="1"
                        value={active.rotate}
                        onChange={(e) => updateActive({ rotate: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div style={styles.row}>
                    <button
                      onClick={() => updateActive({ bold: !active.bold })}
                      style={{
                        ...styles.smallBtn,
                        background: active.bold ? "#2a0b62" : "#fff",
                        color: active.bold ? "#fff" : "#2a0b62",
                      }}
                    >
                      Bold
                    </button>

                    <button
                      onClick={removeActive}
                      style={{
                        ...styles.smallBtn,
                        borderColor: "#ff4db2",
                        color: "#ff4db2",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", justifyContent: "center", paddingTop: 40, background: "linear-gradient(180deg,#F6F5FF,#FFF)" },
  card: { background: "#fff", padding: 24, borderRadius: 18, boxShadow: "0 10px 30px rgba(79,49,120,0.08)" },
  header: { textAlign: "center", marginBottom: 10 },
  title: { fontSize: 26, fontWeight: 800, color: "#2a0b62", margin: 0 },
  subtitle: { marginTop: 6, color: "#6b4aa3", fontSize: 13 },

  fileInput: { display: "none" },

  topActions: { display: "flex", gap: 10, alignItems: "center", marginTop: 10, marginBottom: 14, flexWrap: "wrap" },
  uploadBtn: { padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(74,108,247,0.12)", background: "transparent", color: "#4a6cf7", fontWeight: 800, cursor: "pointer" },
  convertBtn: { padding: "10px 14px", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#7b3cf5,#ff4db2)", color: "#fff", fontWeight: 900, cursor: "pointer" },
  linkBtn: { background: "transparent", border: "none", color: "#6b4aa3", textDecoration: "underline", cursor: "pointer", fontWeight: 800 },
  backLink: { color: "#fff", textDecoration: "none", background: "linear-gradient(90deg,#5e2bd1,#b84bb7)", padding: "6px 10px", borderRadius: 8, fontWeight: 800, fontSize: 13 },

  emptyBox: { border: "1px dashed #e6dfff", borderRadius: 14, padding: 30, background: "#faf8ff", textAlign: "center", color: "#8b68b9", fontWeight: 700 },

  layout: { display: "grid", gridTemplateColumns: "1fr 300px", gap: 14, alignItems: "start" },

  viewer: { border: "1px solid rgba(123,60,245,0.10)", borderRadius: 14, padding: 12, background: "#faf8ff" },
  nav: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  navBtn: { padding: "8px 10px", borderRadius: 10, border: "1px solid #d0c2ff", background: "#fff", fontWeight: 800, cursor: "pointer" },
  navText: { fontWeight: 900, color: "#3b1a6a" },

  canvasWrap: { position: "relative", display: "inline-block", background: "#fff", borderRadius: 12, overflow: "hidden" },
  canvas: { display: "block" },

  overlayBox: {
    position: "absolute",
    padding: "6px 8px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.85)",
    userSelect: "none",
    cursor: "move",
    maxWidth: 520,
    whiteSpace: "pre-wrap",
  },

  tip: { marginTop: 10, color: "#7a66a8", fontSize: 12, fontWeight: 700 },

  panel: { border: "1px solid rgba(123,60,245,0.10)", borderRadius: 14, padding: 12, background: "#fff" },
  panelTitle: { fontWeight: 900, color: "#2a0b62", marginBottom: 10 },
  panelEmpty: { color: "#8b68b9", fontWeight: 700, padding: 12, background: "#faf8ff", borderRadius: 12, border: "1px dashed #e6dfff" },

  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: 900, color: "#4b3b7d" },
  input: { padding: "10px 12px", borderRadius: 12, border: "1px solid #d0c2ff", outline: "none", fontSize: 13 },

  row: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10 },

  smallBtn: { flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid #d0c2ff", background: "#fff", fontWeight: 900, cursor: "pointer" },
};
