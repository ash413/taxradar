"use client";

import { useState, useCallback } from "react";
import { ClassifyResponse, ClassifiedTransaction, ReceiptResult } from "@/types";
import {
  Upload, FileText, AlertCircle, X,
  DollarSign, Brain, Paperclip, ScanLine, Radar
} from "lucide-react";

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptResult[]>([]);
  const [activeTab, setActiveTab] = useState<"transactions" | "receipts">("transactions");

  const handleCSV = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) { setError("Please upload a CSV file."); return; }
    setError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:8000/api/upload/classify", { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Upload failed"); }
      setResult(await res.json());
      setActiveTab("transactions");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setIsUploading(false); }
  }, []);

  const handleReceipt = useCallback(async (file: File) => {
    setIsUploadingReceipt(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:8000/api/upload/receipt", { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Receipt upload failed"); }
      const data: ReceiptResult = await res.json();
      setReceipts(prev => [data, ...prev]);
      setActiveTab("receipts");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Receipt upload failed");
    } finally { setIsUploadingReceipt(false); }
  }, []);

  const onDropCSV = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleCSV(file);
  }, [handleCSV]);

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
    a.download = `taxradar_report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = result ? computeSummary(result.results) : null;
  const matchedTxIds = new Set(receipts.map(r => r.matched_transaction_id).filter(Boolean));
  const hasAnyData = result || receipts.length > 0;

  return (
    <main className="min-h-screen" style={{ background: "#0a0a0f", fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        :root { --green: #00ff88; --amber: #ffb800; --red: #ff4444; --surface: #111118; --border: #1e1e2e; --text: #e2e2f0; --muted: #6b6b8a; }
        .drop-zone { border: 2px dashed var(--border); transition: all 0.2s ease; }
        .drop-zone:hover, .drop-zone.dragging { border-color: var(--green); background: rgba(0,255,136,0.03); }
        .drop-zone-receipt:hover, .drop-zone-receipt.dragging { border-color: var(--amber); background: rgba(255,184,0,0.03); }
        .card { background: var(--surface); border: 1px solid var(--border); }
        .tx-row { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .tx-row:hover { background: rgba(255,255,255,0.02); }
        .tx-row:last-child { border-bottom: none; }
        .badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
        .tab { padding: 6px 16px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; }
        .tab-active { background: rgba(0,255,136,0.1); color: var(--green); border-color: rgba(0,255,136,0.2); }
        .tab-inactive { color: var(--muted); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        .divider { width: 1px; background: var(--border); align-self: stretch; }
        .or-badge { background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-size: 11px; padding: 4px 10px; border-radius: 20px; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #1e1e2e" }} className="px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, padding: "6px 8px" }}>
            <Radar size={18} style={{ color: "var(--green)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>TAXRADAR</h1>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>AI-powered deduction intelligence</p>
          </div>
        </div>
        {hasAnyData && (
          <div className="flex items-center gap-3">
            {result && <>
              <button onClick={() => downloadReport("csv")}
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--muted)", background: "var(--surface)" }}
                className="hover:text-white transition-colors">↓ CSV</button>
              <button onClick={() => downloadReport("pdf")}
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,255,136,0.3)", color: "var(--green)", background: "rgba(0,255,136,0.08)" }}
                className="hover:opacity-80 transition-opacity">↓ PDF Report</button>
            </>}
            <button onClick={() => { setResult(null); setReceipts([]); setError(null); }}
              style={{ color: "var(--muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
              className="hover:text-white transition-colors"><X size={14} /> Reset</button>
          </div>
        )}
      </header>

      <div className="px-8 py-10 max-w-6xl mx-auto">
        {/* Upload zones — always visible */}
        {!result && receipts.length === 0 && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-10 text-center">
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                Scan your expenses.<br /><span style={{ color: "var(--green)" }}>Find every deduction.</span>
              </h2>
              <p style={{ color: "var(--muted)", marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
                Upload a bank statement or a receipt — our AI does the rest.
              </p>
            </div>

            <div className="flex gap-4 items-stretch">
              {/* CSV Upload */}
              <label className={`drop-zone ${isDragging ? "dragging" : ""} rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer flex-1`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)} onDrop={onDropCSV}>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSV(f); }} />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div style={{ width: 40, height: 40, border: "2px solid var(--border)", borderTopColor: "var(--green)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <p style={{ color: "var(--muted)", fontSize: 12 }}>Classifying with AI...</p>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 48, height: 48, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Upload size={20} style={{ color: "var(--green)" }} />
                    </div>
                    <div className="text-center">
                      <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}>Bank Statement</p>
                      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>Drop a CSV file here</p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                      {["Chase", "BofA", "Wells Fargo", "Capital One"].map((b) => (
                        <span key={b} className="badge" style={{ background: "rgba(255,255,255,0.04)", color: "var(--muted)", border: "1px solid var(--border)" }}>{b}</span>
                      ))}
                    </div>
                  </>
                )}
              </label>

              {/* Divider */}
              <div className="flex flex-col items-center justify-center gap-2" style={{ minWidth: 32 }}>
                <div className="divider" />
                <span className="or-badge">or</span>
                <div className="divider" />
              </div>

              {/* Receipt Upload */}
              <label className={`drop-zone drop-zone-receipt rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer flex-1`}>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceipt(f); }} />
                {isUploadingReceipt ? (
                  <div className="flex flex-col items-center gap-3">
                    <div style={{ width: 40, height: 40, border: "2px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <p style={{ color: "var(--muted)", fontSize: 12 }}>Scanning receipt...</p>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 48, height: 48, background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ScanLine size={20} style={{ color: "var(--amber)" }} />
                    </div>
                    <div className="text-center">
                      <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}>Receipt or Invoice</p>
                      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>JPG, PNG, or PDF</p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                      {["Photo", "Scan", "PDF Invoice"].map((b) => (
                        <span key={b} className="badge" style={{ background: "rgba(255,255,255,0.04)", color: "var(--muted)", border: "1px solid var(--border)" }}>{b}</span>
                      ))}
                    </div>
                  </>
                )}
              </label>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)" }}>
                <AlertCircle size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
                <p style={{ color: "#ff7777", fontSize: 13 }}>{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {hasAnyData && (
          <div className="fade-in">
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <StatCard label="Transactions" value={result ? result.summary.parsed_rows.toString() : "—"} icon={FileText} />
              <StatCard label="Likely Deductible" value={summary ? `$${summary.deductibleTotal.toFixed(2)}` : "—"} icon={DollarSign} accent="green" />
              <StatCard label="Needs Review" value={summary ? summary.reviewCount.toString() : "—"} icon={AlertCircle} accent="amber" />
              <StatCard label="Receipts Scanned" value={receipts.length.toString()} icon={ScanLine} accent={receipts.length > 0 ? "amber" : undefined} />
            </div>

            {/* Deduction buckets — only if CSV uploaded */}
            {result && summary && (
              <div className="card rounded-2xl p-6 mb-6">
                <h3 style={{ color: "var(--text)", fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Deduction Summary by Category</h3>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(summary.byBucket).map(([bucket, data]) => (
                    <div key={bucket} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{bucket}</p>
                      <p style={{ fontSize: 18, fontWeight: 500, color: "var(--green)" }}>${data.total.toFixed(2)}</p>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{data.count} transaction{data.count !== 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs + add more */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                {result && (
                  <button className={`tab ${activeTab === "transactions" ? "tab-active" : "tab-inactive"}`}
                    onClick={() => setActiveTab("transactions")}>
                    Transactions ({result.results.length})
                  </button>
                )}
                <button className={`tab ${activeTab === "receipts" ? "tab-active" : "tab-inactive"}`}
                  onClick={() => setActiveTab("receipts")}>
                  Receipts ({receipts.length})
                </button>
              </div>
              <div className="flex gap-2">
                {!result && (
                  <label style={{ cursor: "pointer" }}>
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSV(f); }} />
                    <div style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--muted)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 6 }}>
                      {isUploading
                        ? <><div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: "var(--green)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Classifying...</>
                        : <><Upload size={12} /> Add Bank Statement</>}
                    </div>
                  </label>
                )}
                <label style={{ cursor: "pointer" }}>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceipt(f); }} />
                  <div style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,184,0,0.3)", color: "var(--amber)", background: "rgba(255,184,0,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
                    {isUploadingReceipt
                      ? <><div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Scanning...</>
                      : <><ScanLine size={12} /> Scan Receipt</>}
                  </div>
                </label>
              </div>
            </div>

            {/* Transactions tab */}
            {activeTab === "transactions" && result && (
              <div className="card rounded-2xl overflow-hidden">
                <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                  <h3 style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}>
                    All transactions — <span style={{ color: "var(--green)" }}>{result.filename}</span>
                  </h3>
                </div>
                <div className="grid px-6 py-3" style={{ gridTemplateColumns: "100px 1fr 140px 90px 160px 24px", gap: 12, borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Description", "Category", "Amount", "Eligibility", ""].map((h, i) => (
                    <p key={i} style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, letterSpacing: "0.06em" }}>{h.toUpperCase()}</p>
                  ))}
                </div>
                <div className="scrollbar-thin overflow-y-auto" style={{ maxHeight: 480 }}>
                  {result.results.map((r) => (
                    <TxRow key={r.transaction.id} item={r} hasReceipt={matchedTxIds.has(r.transaction.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* Receipts tab */}
            {activeTab === "receipts" && (
              <div>
                {receipts.length === 0 ? (
                  <div className="card rounded-2xl p-16 flex flex-col items-center gap-3">
                    <ScanLine size={24} style={{ color: "var(--muted)" }} />
                    <p style={{ color: "var(--muted)", fontSize: 14 }}>No receipts scanned yet</p>
                    <p style={{ color: "var(--muted)", fontSize: 12 }}>Click "Scan Receipt" to add a photo or PDF</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {receipts.map((r, i) => <ReceiptCard key={i} receipt={r} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

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

function TxRow({ item, hasReceipt }: { item: ClassifiedTransaction; hasReceipt: boolean }) {
  const { transaction: tx, classification: cl } = item;
  const isExpense = tx.amount < 0;
  const eligibilityColor: Record<string, string> = {
    "deductible": "var(--green)", "likely deductible": "#88ffcc",
    "partially deductible": "var(--amber)", "review needed": "#ffaa00", "non-deductible": "var(--muted)",
  };
  const eligibilityBg: Record<string, string> = {
    "deductible": "rgba(0,255,136,0.1)", "likely deductible": "rgba(0,255,136,0.07)",
    "partially deductible": "rgba(255,184,0,0.1)", "review needed": "rgba(255,170,0,0.1)", "non-deductible": "rgba(255,255,255,0.04)",
  };
  const ec = eligibilityColor[cl.eligibility] ?? "var(--muted)";
  const eb = eligibilityBg[cl.eligibility] ?? "rgba(255,255,255,0.04)";
  return (
    <div className="tx-row grid px-6 py-4 items-center" style={{ gridTemplateColumns: "100px 1fr 140px 90px 160px 24px", gap: 12 }}>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>{tx.date ? fmtDate(tx.date) : "—"}</p>
      <div>
        <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</p>
        {cl.source === "ai" && <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>✦ AI · {cl.reason.slice(0, 60)}...</p>}
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cl.category}</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: isExpense ? "#ff7777" : "var(--green)" }}>
        {isExpense ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
      </p>
      <span className="badge" style={{ background: eb, color: ec, border: `1px solid ${ec}22` }}>{cl.eligibility}</span>
      <div title={hasReceipt ? "Receipt attached" : ""}>{hasReceipt && <Paperclip size={13} style={{ color: "var(--green)" }} />}</div>
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: ReceiptResult }) {
  if (!receipt.success) return (
    <div className="card rounded-xl p-5"><p style={{ color: "var(--red)", fontSize: 13 }}>Failed: {receipt.error}</p></div>
  );
  const p = receipt.parsed;
  return (
    <div className="card rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{p.merchant || "Unknown Merchant"}</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.date || "Date not found"} · {p.payment_method}</p>
        </div>
        <p style={{ fontSize: 20, fontWeight: 500, color: "var(--amber)" }}>${p.total?.toFixed(2) ?? "—"}</p>
      </div>
      {p.line_items?.length > 0 && (
        <div className="mb-4">
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.06em" }}>LINE ITEMS</p>
          {p.line_items.map((item, i) => (
            <div key={i} className="flex justify-between" style={{ fontSize: 12, color: "var(--text)", marginBottom: 3 }}>
              <span>{item.description}</span>
              <span style={{ color: "var(--muted)" }}>${item.amount?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>AI ASSESSMENT</p>
        <p style={{ fontSize: 12, color: "var(--text)" }}>{p.business_purpose_hint}</p>
      </div>
      {receipt.matched_transaction_description && (
        <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)" }}>
          <Paperclip size={11} style={{ color: "var(--green)" }} />
          <p style={{ fontSize: 11, color: "var(--green)" }}>Matched: {receipt.matched_transaction_description}</p>
        </div>
      )}
    </div>
  );
}

function computeSummary(results: ClassifiedTransaction[]) {
  let deductibleTotal = 0, reviewCount = 0, aiCount = 0;
  const byBucket: Record<string, { total: number; count: number }> = {};
  for (const { transaction: tx, classification: cl } of results) {
    if (cl.source === "ai") aiCount++;
    if (cl.eligibility === "review needed") reviewCount++;
    if (["deductible", "likely deductible", "partially deductible"].includes(cl.eligibility) && tx.amount < 0) {
      deductibleTotal += Math.abs(tx.amount);
      const b = cl.deduction_bucket;
      if (!byBucket[b]) byBucket[b] = { total: 0, count: 0 };
      byBucket[b].total += Math.abs(tx.amount);
      byBucket[b].count++;
    }
  }
  return { deductibleTotal, reviewCount, aiCount, byBucket };
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}