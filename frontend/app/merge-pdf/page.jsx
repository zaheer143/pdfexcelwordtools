
"use client";
import { useState } from "react";
import "../globals.css";

export default function MergePDF(){
  const [files,setFiles] = useState([]);

  async function mergeFree(){
    const fd = new FormData();
    for(let f of files) fd.append("files", f);
    const res = await fetch("http://localhost:3001/merge-pdf", { method:"POST", body:fd});
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="merged.pdf"; a.click();
  }

  async function mergeAI(){
    const fd = new FormData();
    for(let f of files) fd.append("files", f);
    const res = await fetch("http://localhost:3001/merge-pdf-ai", { method:"POST", body:fd});
    const blob= await res.blob();
    const url= URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="merged_ai.pdf"; a.click();
  }

  return (
    <div className="card">
      <h1>Merge PDF</h1>
      <input type="file" multiple onChange={(e)=>setFiles(e.target.files)}/>
      <button onClick={mergeFree}>Merge (Free)</button>
      <button className="premium" onClick={mergeAI}>Merge with AI (Premium)</button>
      <a href="/" style={{display:"block",marginTop:"20px"}}>Back Home</a>
    </div>
  );
}
