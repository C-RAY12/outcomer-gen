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

// ─── HL API HELPERS ─────────────────────────────────────────────────────────
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

// ─── UTILS ──────────────────────────────────────────────────────────────────
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

// ─── COMPONENTS ─────────────────────────────────────────────────────────────
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
        <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: 24, fontWeight: 900, color: clr }}>{score ?? "?"}</div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: clr }}>TRUST SCORE</div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────
function OutcomerGen() {
  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme];
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!selectedMarket) return;
    setLoading(true);
    try {
      const l2 = await hlPost({ type: "l2Book", coin: selectedMarket.coin });
      const bids = l2?.levels?.[0] || [];
      const asks = l2?.levels?.[1] || [];
      const bestBid = bids[0] ? parseFloat(bids[0].px) : null;
      const bestAsk = asks[0] ? parseFloat(asks[0].px) : null;
      const depth = [...bids, ...asks].reduce((acc, l) => acc + (parseFloat(l.sz) * parseFloat(l.px)), 0);

      setMarketData({
        coin: selectedMarket.coin,
        bestBid, bestAsk,
        spread: (bestBid && bestAsk) ? (bestAsk - bestBid) : null,
        depth: scaleSize(depth, selectedMarket.szDecimals),
        trustScore: calcTrustScore({ spread: (bestAsk - bestBid), depth })
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedMarket]);

  useEffect(() => {
    const init = async () => {
      try {
        const meta = await hlPost({ type: "meta" });
        const list = (meta?.universe || []).slice(0, 10).map(m => ({ coin: m.name, szDecimals: m.szDecimals }));
        if (list.length > 0) setSelectedMarket(list[0]);
      } catch (e) {
        setSelectedMarket({ coin: "SOL", szDecimals: 2 });
      }
    };
    init();
  }, []);

  useEffect(() => { if (selectedMarket) refresh(); }, [selectedMarket, refresh]);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "monospace", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
          <h1 style={{ fontWeight: 900, color: t.accent }}>OUTCOMERGEN</h1>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ padding: 8, background: t.card, color: t.text, border: `1px solid ${t.border}` }}>
            {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 12, color: t.accent, marginBottom: 16 }}>MARKET HEALTH</h2>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{marketData?.coin || "---"}</p>
                <p style={{ color: t.yes }}>Bid: {fmtNum(marketData?.bestBid)}</p>
                <p style={{ color: t.no }}>Ask: {fmtNum(marketData?.bestAsk)}</p>
              </div>
              <TrustGauge score={marketData?.trustScore} t={t} />
            </div>
          </div>
          
          <div style={{ background: t.card, border: `1px solid ${t.border}`, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 12, color: t.accent, marginBottom: 16 }}>WHALE SIEVE</h2>
            <p style={{ color: t.textMuted, fontSize: 12 }}><Fish size={14}/> Scanning positions...</p>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

// ─── VITE ENTRY POINT ───────────────────────────────────────────────────────
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<OutcomerGen />);
}
