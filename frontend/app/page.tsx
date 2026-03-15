"use client";

import { useState, useCallback } from "react";
import { ClassifyResponse, ClassifiedTransaction } from "@/types";
import { Upload, FileText, AlertCircle, CheckCircle2, X, DollarSign, ReceiptText, Brain } from "lucide-react";

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) { setError("Please upload a CSV file."); return; }
    setError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:8000/api/upload/classify", { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Upload failed"); }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setIsUploading(false); }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  // Compute deduction summary
  const summary = result ? computeSummary(result.results) : null;

  const downloadReport = async (format: "csv" | "pdf") => {
    if (!result) return;
    const res = await fetch(`http://localhost:8000/api/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: result.results, summary: result.summary, filename: result.filename }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deduction_report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen" style={{ background: "#0a0a0f", fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        :root { --green: #00ff88; --amber: #ffb800; --red: #ff4444; --surface: #111118; --border: #1e1e2e; --text: #e2e2f0; --muted: #6b6b8a; }
        .drop-zone { border: 2px dashed var(--border); transition: all 0.2s ease; }
        .drop-zone:hover, .drop-zone.dragging { border-color: var(--green); background: rgba(0,255,136,0.03); }
        .card { background: var(--surface); border: 1px solid var(--border); }
        .tx-row { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .tx-row:hover { background: rgba(255,255,255,0.02); }
        .tx-row:last-child { border-bottom: none; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #1e1e2e" }} className="px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, padding: "6px 8px" }}>
            <ReceiptText size={18} style={{ color: "var(--green)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>TAX DEDUCTION HUNTER</h1>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>AI-powered expense intelligence</p>
          </div>
        </div>
        {result && (
          <div className="flex items-center gap-3">
            <button onClick={() => downloadReport("csv")}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--muted)", background: "var(--surface)" }}
              className="hover:text-white transition-colors">
              ↓ CSV
            </button>
            <button onClick={() => downloadReport("pdf")}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,255,136,0.3)", color: "var(--green)", background: "rgba(0,255,136,0.08)" }}
              className="hover:opacity-80 transition-opacity">
              ↓ PDF Report
            </button>
            <button onClick={() => { setResult(null); setError(null); }}
              style={{ color: "var(--muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
              className="hover:text-white transition-colors">
              <X size={14} /> New upload
            </button>
          </div>
        )}
      </header>

      <div className="px-8 py-10 max-w-6xl mx-auto">
        {!result ? (
          // --- Upload Screen ---
          <div className="max-w-2xl mx-auto">
            <div className="mb-10 text-center">
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                Find your<br /><span style={{ color: "var(--green)" }}>hidden deductions</span>
              </h2>
              <p style={{ color: "var(--muted)", marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
                Upload a bank statement CSV. Our AI classifies every transaction<br />and flags what's likely tax deductible.
              </p>
            </div>

            <label className={`drop-zone ${isDragging ? "dragging" : ""} rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div style={{ width: 48, height: 48, border: "2px solid var(--border)", borderTopColor: "var(--green)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>Classifying transactions with AI...</p>
                </div>
              ) : (
                <>
                  <div style={{ width: 56, height: 56, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Upload size={24} style={{ color: "var(--green)" }} />
                  </div>
                  <div className="text-center">
                    <p style={{ color: "var(--text)", fontSize: 15, fontWeight: 500 }}>Drop your CSV here</p>
                    <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>or click to browse</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {["Chase", "BofA", "Wells Fargo", "Capital One", "Citi"].map((b) => (
                      <span key={b} className="badge" style={{ background: "rgba(255,255,255,0.04)", color: "var(--muted)", border: "1px solid var(--border)" }}>{b}</span>
                    ))}
                  </div>
                </>
              )}
            </label>

            {error && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)" }}>
                <AlertCircle size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
                <p style={{ color: "#ff7777", fontSize: 13 }}>{error}</p>
              </div>
            )}
          </div>
        ) : (
          // --- Results Screen ---
          <div className="fade-in">
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <StatCard label="Transactions" value={result.summary.parsed_rows.toString()} icon={FileText} />
              <StatCard label="Likely Deductible" value={`$${summary!.deductibleTotal.toFixed(2)}`} icon={DollarSign} accent="green" />
              <StatCard label="Needs Review" value={summary!.reviewCount.toString()} icon={AlertCircle} accent="amber" />
              <StatCard label="AI Classified" value={summary!.aiCount.toString()} icon={Brain} />
            </div>

            {/* Deduction buckets */}
            <div className="card rounded-2xl p-6 mb-6">
              <h3 style={{ color: "var(--text)", fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Deduction Summary by Category</h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(summary!.byBucket).map(([bucket, data]) => (
                  <div key={bucket} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{bucket}</p>
                    <p style={{ fontSize: 18, fontWeight: 500, color: "var(--green)" }}>${data.total.toFixed(2)}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{data.count} transaction{data.count !== 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transactions table */}
            <div className="card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}>
                  All transactions — <span style={{ color: "var(--green)" }}>{result.filename}</span>
                </h3>
              </div>
              {/* Table header */}
              <div className="grid px-6 py-3" style={{ gridTemplateColumns: "100px 1fr 140px 90px 160px", gap: 12, borderBottom: "1px solid var(--border)" }}>
                {["Date", "Description", "Category", "Amount", "Eligibility"].map((h) => (
                  <p key={h} style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, letterSpacing: "0.06em" }}>{h.toUpperCase()}</p>
                ))}
              </div>
              <div className="scrollbar-thin overflow-y-auto" style={{ maxHeight: 480 }}>
                {result.results.map((r) => <TxRow key={r.transaction.id} item={r} />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// --- Sub-components ---

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ElementType; accent?: "green" | "amber"; }) {
  const color = accent === "green" ? "var(--green)" : accent === "amber" ? "var(--amber)" : "var(--muted)";
  return (
    <div className="card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color }} />
        <p style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.06em", fontWeight: 500 }}>{label.toUpperCase()}</p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 500, color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function TxRow({ item }: { item: ClassifiedTransaction }) {
  const { transaction: tx, classification: cl } = item;
  const isExpense = tx.amount < 0;
  const eligibilityColor = {
    "deductible": "var(--green)",
    "likely deductible": "#88ffcc",
    "partially deductible": "var(--amber)",
    "review needed": "#ffaa00",
    "non-deductible": "var(--muted)",
  }[cl.eligibility] ?? "var(--muted)";

  const eligibilityBg = {
    "deductible": "rgba(0,255,136,0.1)",
    "likely deductible": "rgba(0,255,136,0.07)",
    "partially deductible": "rgba(255,184,0,0.1)",
    "review needed": "rgba(255,170,0,0.1)",
    "non-deductible": "rgba(255,255,255,0.04)",
  }[cl.eligibility] ?? "rgba(255,255,255,0.04)";

  return (
    <div className="tx-row grid px-6 py-4 items-center" style={{ gridTemplateColumns: "100px 1fr 140px 90px 160px", gap: 12 }}>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>{tx.date ? fmtDate(tx.date) : "—"}</p>
      <div>
        <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</p>
        {cl.source === "ai" && <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>✦ AI · {cl.reason.slice(0, 60)}...</p>}
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cl.category}</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: isExpense ? "#ff7777" : "var(--green)" }}>
        {isExpense ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
      </p>
      <span className="badge" style={{ background: eligibilityBg, color: eligibilityColor, border: `1px solid ${eligibilityColor}22` }}>
        {cl.eligibility}
      </span>
    </div>
  );
}

// --- Helpers ---

function computeSummary(results: ClassifiedTransaction[]) {
  let deductibleTotal = 0;
  let reviewCount = 0;
  let aiCount = 0;
  const byBucket: Record<string, { total: number; count: number }> = {};

  for (const { transaction: tx, classification: cl } of results) {
    if (cl.source === "ai") aiCount++;
    if (cl.eligibility === "review needed") reviewCount++;

    const isDeductible = ["deductible", "likely deductible", "partially deductible"].includes(cl.eligibility);
    if (isDeductible && tx.amount < 0) {
      deductibleTotal += Math.abs(tx.amount);
      const bucket = cl.deduction_bucket;
      if (!byBucket[bucket]) byBucket[bucket] = { total: 0, count: 0 };
      byBucket[bucket].total += Math.abs(tx.amount);
      byBucket[bucket].count++;
    }
  }

  return { deductibleTotal, reviewCount, aiCount, byBucket };
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}