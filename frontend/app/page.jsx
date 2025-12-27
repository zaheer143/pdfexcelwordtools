"use client";
import Link from "next/link";

export default function Home() {
  const tools = [
    { name: "PDF → Word", link: "/pdf-to-word", desc: "Convert PDF to editable Word" },
    { name: "Merge PDF", link: "/merge-pdf", desc: "Combine multiple PDFs" },
    { name: "Compress PDF", link: "/compress-pdf", desc: "Reduce PDF size" },
    { name: "Split PDF", link: "/split-pdf", desc: "Split PDF pages" },
    { name: "Protect PDF", link: "/protect-pdf", desc: "Add password to PDF" },
    { name: "Unlock PDF", link: "/unlock-pdf", desc: "Remove PDF password" },
    { name: "PDF → JPG", link: "/pdf-to-jpg", desc: "Convert PDF pages to images" },
    { name: "JPG → PDF", link: "/jpg-to-pdf", desc: "Convert images to PDF" },
    { name: "PDF → PPT", link: "/pdf-to-ppt", desc: "Convert PDF to PowerPoint" },
    { name: "Word → PDF", link: "/word-to-pdf", desc: "Convert Word to PDF" },
    { name: "Excel → PDF", link: "/excel-to-pdf", desc: "Convert Excel to PDF" },
    { name: "PPT → PDF", link: "/ppt-to-pdf", desc: "Convert PowerPoint to PDF" },
    { name: "PDF → Excel", link: "/pdf-to-excel", desc: "Convert PDF to Excel" },
    { name: "Rotate PDF", link: "/rotate-pdf", desc: "Rotate PDF pages" },
    { name: "Watermark PDF", link: "/watermark-pdf", desc: "Add watermark to PDF" },
  { name: "Extract Images", desc: "Extract all images from a PDF", link: "/extract-images" },
  { name: "Remove Pages", desc: "Remove specific pages from a PDF", link: "/remove-pages" },
  { name: "Add Page Numbers", desc: "Add page numbers to a PDF", link: "/add-page-numbers" },
  { name: "PDF → PNG", desc: "Convert PDF to PNG", link: "/pdf-to-png" },
  { name: "PDF → TXT", desc: "Convert PDF to TXT", link: "/pdf-to-txt" },
  { name: "Delete Blank Pages", desc: "Delete blank pages from a PDF", link: "/delete-blank-pages" },
  { name: "Type on PDF", desc: "Type on a PDF", link: "/type-on-pdf" },
  { name: "OCR PDF", desc: "Extract text from a PDF", link: "/ocr-pdf" },
  { name: "Flatten PDF", desc: "Flattenpdf from a PDF", link: "/flatten-pdf" },
  { name: "PDF to PDFA", desc: "Flattenpdf from a PDF", link: "/pdf-to-pdfa" },
  { name: "Compress To Size", desc: "Compress to size", link: "/compress-to-size" },
  { name: "Gray Scale PDF", desc: "Gray Scale PDF", link: "/grayscale-pdf" },
  { name: "Remove Metadata PDF", desc: "Remove Metadata PDF", link: "/remove-metadata" },
  { name: " PDF Repair", desc: " PDF rEPAIR", link: "/pdf-repair" },
  { name: "Bulk Pdf Compress", desc: " Bulk Pdf Compress", link: "/bulk-compress" },
  { name: "Bulk Gray Scale", desc: " Bulk Gray Scale", link: "/bulk-grayscale" },
  { name: "Split PDF by Size", link: "/split-by-size", desc: "Split PDF into parts under a size limit" },
  { name: "Compare PDFs", link: "/compare-pdf", desc: "Highlight differences between two PDFs" },
  { name: "Bulk Watermark PDF", link: "/bulk-watermark-pdf", desc: "Add the same watermark to many PDFs (ZIP output)" },
  { name: "Bulk Rename PDF", link: "/bulk-rename-pdf", desc: "Rename multiple PDFs and download a ZIP" },
  { name: "Bulk Merge PDF", link: "/bulk-merge-pdf", desc: "Merge multiple PDFs into one file" },
  { name: "Bulk Split PDF", link: "/bulk-split-pdf", desc: "Split a PDF into many parts (ZIP output)" },
  { name: "Bulk Rotate PDF", link: "/bulk-rotate-pdf", desc: "Rotate PDFs (ZIP supported)" },
  { name: "Bulk Page Numbers PDF", link: "/bulk-page-numbers-pdf", desc: "Add page numbers to PDFs (ZIP supported)" },
  {  name: "Bulk Protect PDF",  link: "/bulk-protect-pdf", desc: "Add password protection to PDFs (ZIP supported)"},
  { name: "PDF Redact", link: "/bulk-redact-pdf", desc: "PDF Redact" },
  








 
  ];

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>DocuForge AI — The Ultimate AI Document Powerhouse</h1>
      <p style={styles.subtitle}>Your complete AI-powered PDF workspace</p>

      <div style={styles.grid}>
        {tools.map((tool, index) => (
          <Link href={tool.link} key={index} style={styles.card}>
            <div style={styles.cardContent}>
              <h2 style={styles.cardTitle}>{tool.name}</h2>
              <p style={styles.cardDesc}>{tool.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "50px 20px",
    background: "linear-gradient(180deg,#F6F1FF,#FFFFFF)",
    textAlign: "center",
  },
  title: {
    fontSize: "38px",
    fontWeight: "900",
    color: "#2a0b62",
    marginBottom: "5px",
  },
  subtitle: {
    fontSize: "16px",
    color: "#6a4bb8",
    marginBottom: "40px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "22px",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  card: {
    textDecoration: "none",
    background: "white",
    padding: "22px",
    borderRadius: "20px",
    border: "2px solid transparent",
    backgroundImage:
      "linear-gradient(white, white), linear-gradient(90deg, #7b3cf5, #ff4db2)",
    backgroundOrigin: "border-box",
    backgroundClip: "content-box, border-box",
    boxShadow: "0 8px 25px rgba(124, 58, 237, 0.15)",
    transition: "0.25s",
    cursor: "pointer",
  },
  cardContent: {
    textAlign: "center",
  },
  cardTitle: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#3e0f79",
  },
  cardDesc: {
    fontSize: "14px",
    color: "#7a68a5",
    marginTop: "6px",
  },
};
