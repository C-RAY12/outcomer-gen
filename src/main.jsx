import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
// Import all necessary icons from lucide-react
import { Activity, Zap, Eye, AlertTriangle, RefreshCw, Moon, Sun, TrendingUp, TrendingDown, Minus, Shield, Fish, MessageSquare, ChevronRight, Circle, BarChart2 } from "lucide-react";
// Import Recharts components for the Whale Sieve visualization
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── THEME SYSTEM ───────────────────────────────────────────────────────────
// High-contrast industrial themes for Web3 monitoring
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

// ─── HYPERLIQUID TESTNET API CONFIG ──────────────────────────────────────────
const HL_API = "https://api.hyperliquid-testnet.xyz/info";

// Helper for POST requests to the Hyperliquid Info API
async function hlPost(body) {
  const r = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── UTILITY FUNCTIONS (FORMATTING) ──────────────────────────────────────────
function scaleSize(raw, szDecimals) {
  if (raw == null || szDecimals == null) return null;
  return parseFloat(raw) / Math.pow(10, szDecimals);
}

function fmtNum(n, decimals = 4) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUSD(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// Logic to determine market health score based on depth and spread
function calcTrustScore({ spread, depth }) {
  if (spread == null || depth == null) return null;
  const spreadPenalty = Math.max(0, 1 - spread * 10);
  const depthBonus = Math.min(1, depth / 10000);
  return Math.round(((spreadPenalty + depthBonus) / 2) * 100);
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────

// Gauge showing the trust score of a market
function TrustGauge({ score, t }) {
  const clr = score >= 75 ? t.yes : score >= 45 ? t.warn : t.no;
  const pct = score ?? 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: 100, height: 50 }}>
        <svg width="100" height="50" viewBox="0 0 100 50">
          <path d="M10 45 A40 40 0 0 1 90 45" fill="none" stroke={t.border} strokeWidth={8} strokeLinecap="round" />
          <path d="M10 45 A40 40 0 0 1 90 45" fill="none" stroke={clr} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(pct / 100) * 126} 126`} />
        </svg>
        <div style={{ position: "absolute", bottom: 0, width: "100%", textAlign: "center", fontSize: 20, fontWeight: 900, color: clr }}>{score ?? "?"}</div>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: clr }}>TRUST SCORE</div>
    </div>
  );
}

// ─── MAIN APP COMPONENT ───────────────────────────────────────────────────────
function OutcomerGen() {
  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme];

  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize market list from Hyperliquid or fallback to demo
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const meta = await hlPost({ type: "meta" });
        const list = (meta?.universe || []).slice(0, 10).map(m => ({ coin: m.name, szDecimals: m.szDecimals }));
        setMarkets(list);
        if (list.length > 0) setSelectedMarket(list[0]);
      } catch (e) {
        setError("Using Demo Data (API Restricted)");
        const demo = [{ coin: "BTC-OUTCOME", szDecimals: 2 }, { coin: "ETH-OUTCOME", szDecimals: 2 }];
        setMarkets(demo);
        setSelectedMarket(demo[0]);
      }
      setLoading(false);
    }
    init();
  }, []);

  // Fetch specific market details (Spread, Depth, etc.)
  const refreshData = useCallback(async () => {
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
        bestBid,
        bestAsk,
        spread: (bestBid && bestAsk) ? (bestAsk - bestBid) : null,
        depth: scaleSize(depth, selectedMarket.szDecimals),
        trustScore: calcTrustScore({ spread: (bestAsk - bestBid), depth })
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [selectedMarket]);

  useEffect(() => { refreshData(); }, [refreshData]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: t.bg, color: t.text, fontFamily: "monospace", padding: "20px" }}>
      {/* Background Grid Pattern */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`, backgroundSize: "32px 32px", opacity: 0.2, pointerEvents: "none" }} />

      <div style={{ position: "relative", maxWidth: "900px", margin: "0 auto" }}>
        
        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 900, letterSpacing: "-1px" }}>
              OUTCOMER<span style={{ color: t.accent }}>GEN</span>
            </h1>
            <div style={{ fontSize: "10px", color: t.textMuted, letterSpacing: "2px" }}>INTELLIGENCE LAYER v1.0</div>
          </div>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${t.border}`, background: t.card, color: t.text, cursor: "pointer" }}>
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={refreshData} style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${t.accent}`, background: t.accentSoft, color: t.accent, cursor: "pointer" }}>
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          
          {/* Market Health Card */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "20px", boxShadow: t.glow }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: t.accent }}>MARKET HEALTH</div>
              {error && <div style={{ fontSize: "10px", color: t.warn }}>{error}</div>}
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "18px", fontWeight: "bold" }}>{marketData?.coin || "SELECT MARKET"}</div>
                <div style={{ fontSize: "12px" }}>Bid: <span style={{ color: t.yes }}>{fmtNum(marketData?.bestBid)}</span></div>
                <div style={{ fontSize: "12px" }}>Ask: <span style={{ color: t.no }}>{fmtNum(marketData?.bestAsk)}</span></div>
              </div>
              <TrustGauge score={marketData?.trustScore} t={t} />
            </div>
          </div>

          {/* Whale Sieve Placeholder */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: t.accent, marginBottom: "15px" }}>WHALE SIEVE</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: t.textMuted }}>
              <Fish size={20} />
              <span style={{ fontSize: "12px" }}>Scanning for high-value positions...</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ marginTop: "40px", textAlign: "center", fontSize: "10px", color: t.textMuted }}>
          PHASE 1: FOUNDATION • SYNCED: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// ─── VITE ENTRY POINT ────────────────────────────────────────────────────────
// This replaces the old index.js logic and mounts the app into #root
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<OutcomerGen />);
}

export default OutcomerGen;
