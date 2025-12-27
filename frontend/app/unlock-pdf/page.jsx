"use client";
import { useState } from "react";
import Link from "next/link";

export default function UnlockPDF() {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = (e) => setFile(e.target.files[0]);

  const unlock = async () => {
    if (!file) return alert("Please upload a PDF first!");
    if (!password) return alert("Enter the PDF password!");

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    const response = await fetch("http://localhost:3001/unlock-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      setLoading(false);
      return alert("Wrong password or unlock failed.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "unlocked.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setLoading(false);
  };

  return (
    <div style={{
      width: "500px",
      margin: "60px auto",
      background: "white",
      padding: "30px",
      borderRadius: "12px",
      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
      textAlign: "center"
    }}>
      
      <h2 style={{ fontSize: "32px", marginBottom: "20px", fontWeight: "bold" }}>
        Unlock PDF
      </h2>

      <input
        type="file"
        accept="application/pdf"
        onChange={handleUpload}
        style={{ marginBottom: "20px" }}
      />

      <input
        type="password"
        placeholder="Enter Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          border: "1px solid #ddd",
          borderRadius: "6px",
          marginBottom: "20px"
        }}
      />

      <button
        onClick={unlock}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          background: "#4169e1",
          border: "none",
          color: "white",
          borderRadius: "6px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "15px"
        }}
      >
        {loading ? "Unlocking..." : "Unlock PDF"}
      </button>

      <Link href="/" style={{ color: "#5a2ca0", textDecoration: "underline" }}>
        Back Home
      </Link>
    </div>
  );
}
