import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Zap, Eye, AlertTriangle, RefreshCw, Moon, Sun, TrendingUp, TrendingDown, Minus, Shield, Fish, MessageSquare, ChevronRight, Circle, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── THEME SYSTEM ───────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#050d1a",
    surface: "#0a1628",
    card: "#0d1e35",
    border: "#1a3050",
    accent: "#00f5c4",
    accentSoft: "#00f5c420",
    accentDim: "#00c9a0",
    text: "#e2eaf5",
    textMuted: "#5a7a9a",
    textDim: "#8aa0bc",
    yes: "#00f5c4",
    no: "#f5305a",
    warn: "#f5a623",
    grid: "#0d1e3580",
    badge: "#0a2040",
    glow: "0 0 20px #00f5c430",
    scanline: true,
  },
  light: {
    bg: "#f0f4fa",
    surface: "#ffffff",
    card: "#ffffff",
    border: "#dce6f5",
    accent: "#0070f3",
    accentSoft: "#0070f315",
    accentDim: "#0050c0",
    text: "#0a1628",
    textMuted: "#8090ac",
    textDim: "#4a6080",
    yes: "#00a878",
    no: "#e5264a",
    warn: "#d47a00",
    grid: "#dce6f580",
    badge: "#eaf0fb",
    glow: "0 4px 24px #0070f318",
    scanline: false,
  },
};

// ─── API CONFIG ─────────────────────────────────────────────────────────────
const HL_API = "https://api.hyperliquid-testnet.xyz/info";

async function hlPost(body) {
  const r = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── UTILITIES & DATA PROCESSING ────────────────────────────────────────────
const scaleSize = (raw, szDecimals) => (raw == null || szDecimals == null) ? null : parseFloat(raw) / Math.pow(10, szDecimals);
const fmtNum = (n, d = 4) => (n == null || isNaN(n)) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n) => (n == null || isNaN(n)) ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortAddr = (a) => a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";

function calcTrustScore({ spread, depth }) {
  if (spread == null || depth == null) return null;
  const spreadPenalty = Math.max(0, 1 - spread * 10);
  const depthBonus = Math.min(1, depth / 10000);
  return Math.round(((spreadPenalty + depthBonus) / 2) * 100);
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────
function TrustGauge({ score, t }) {
  const clr = score >= 75 ? t.yes : score >= 45 ? t.warn : t.no;
  const pct = score ?? 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 120, height: 64 }}>
        <svg width={120} height={64} viewBox="0 0 120 64">
          <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={t.border} strokeWidth={10} strokeLinecap="round" />
          <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={clr} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${(pct / 100) * 157} 157`} style={{ filter: `drop-shadow(0 0 6px ${clr})`, transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: 24, fontWeight: 900, color: clr, fontFamily: "monospace" }}>{score ?? "?"}</div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: clr, letterSpacing: 1 }}>TRUST SCORE</div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────
export default function OutcomerGen() {
  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme];
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(async () => {
    if (!selectedMarket) return;
    setLoading(true);
    try {
      const l2 = await hlPost({ type: "l2Book", coin: selectedMarket.coin });
      const bids = l2?.levels?.[0] || [];
      const asks = l2?.levels?.[1] || [];
      const bestBid = bids[0] ? parseFloat(bids[0].px) : null;
      const bestAsk = asks[0] ? parseFloat(asks[0].px) : null;
      const depthUSD = [...bids, ...asks].reduce((acc, l) => acc + (parseFloat(l.sz) * parseFloat(l.px)), 0);

      setMarketData({
        coin: selectedMarket.coin,
        bestBid,
        bestAsk,
        spread: (bestBid && bestAsk) ? (bestAsk - bestBid) : null,
        depth: scaleSize(depthUSD, selectedMarket.szDecimals),
        trustScore: calcTrustScore({ spread: (bestAsk - bestBid), depth: depthUSD })
      });
    } catch (e) { console.error("Refresh failed", e); }
    setLoading(false);
  }, [selectedMarket]);

  useEffect(() => {
    async function init() {
      try {
        const meta = await hlPost({ type: "meta" });
        const list = (meta?.universe || []).slice(0, 10).map(m => ({ coin: m.name, szDecimals: m.szDecimals }));
        setMarkets(list);
        if (list.length > 0) setSelectedMarket(list[0]);
      } catch (e) {
        const demo = [{ coin: "SOL", szDecimals: 2 }, { coin: "BTC", szDecimals: 2 }];
        setMarkets(demo);
        setSelectedMarket(demo[0]);
      }
    }
    init();
  }, []);

  useEffect(() => { if (selectedMarket) refreshData(); }, [selectedMarket, refreshData]);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "monospace", padding: "24px", position: "relative" }}>
      {/* Grid pattern background */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`, backgroundSize: "32px 32px", opacity: 0.3, pointerEvents: "none" }} />
      
      <div style={{ position: "relative", maxWidth: "1000px", margin: "0 auto", zIndex: 1 }}>
        <header style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 900, color: t.accent }}>OUTCOMER<span style={{ color: t.text }}>GEN</span></h1>
            <p style={{ fontSize: "10px", color: t.textMuted, letterSpacing: "2px" }}>INTELLIGENCE LAYER v1.0</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
             <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ padding: "8px", background: t.card, border: `1px solid ${t.border}`, color: t.text, cursor: "pointer", borderRadius: "6px" }}>
               {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
             </button>
             <button onClick={refreshData} style={{ padding: "8px 16px", background: t.accentSoft, border: `1px solid ${t.accent}`, color: t.accent, cursor: "pointer", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
               <RefreshCw size={14} className={loading ? "spin" : ""} /> REFRESH
             </button>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          {/* Market Health Card */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "24px", boxShadow: t.glow }}>
            <h2 style={{ fontSize: "12px", color: t.accent, marginBottom: "20px", letterSpacing: 1 }}>MARKET HEALTH</h2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "12px" }}>{marketData?.coin || "LOADING..."}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <p style={{ fontSize: "13px" }}>Bid: <span style={{ color: t.yes }}>{fmtNum(marketData?.bestBid)}</span></p>
                  <p style={{ fontSize: "13px" }}>Ask: <span style={{ color: t.no }}>{fmtNum(marketData?.bestAsk)}</span></p>
                  <p style={{ fontSize: "13px" }}>Liquidity: <span style={{ color: t.textDim }}>{fmtUSD(marketData?.depth)}</span></p>
                </div>
              </div>
              <TrustGauge score={marketData?.trustScore} t={t} />
            </div>
          </section>

          {/* Whale Sieve Card */}
          <section style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "24px" }}>
            <h2 style={{ fontSize: "12px", color: t.accent, marginBottom: "20px", letterSpacing: 1 }}>WHALE SIEVE</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: t.textMuted }}>
              <Fish size={24} /> 
              <span style={{ fontSize: "12px" }}>Scanning for high-value positions...</span>
            </div>
          </section>
        </div>

        <footer style={{ marginTop: "40px", textAlign: "center", fontSize: "10px", color: t.textMuted, borderTop: `1px solid ${t.border}`, paddingTop: "20px" }}>
          PHASE 1: FOUNDATION • SYNCED: {new Date().toLocaleTimeString()}
        </footer>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<OutcomerGen />);
}
