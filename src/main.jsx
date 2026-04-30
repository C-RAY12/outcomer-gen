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

// ─── HYPERLIQUID TESTNET API ─────────────────────────────────────────────────
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

// ─── DECIMAL NORMALIZATION ───────────────────────────────────────────────────
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

function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  return (n * 100).toFixed(1) + "%";
}

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// ─── TRUST SCORE ─────────────────────────────────────────────────────────────
function calcTrustScore({ spread, depth, volatility }) {
  if (spread == null || depth == null) return null;
  const vol = volatility || 0.01;
  const spreadPenalty = Math.max(0, 1 - spread * 10);
  const depthBonus = Math.min(1, depth / 10000);
  const volPenalty = Math.max(0, 1 - vol * 5);
  return Math.round(((spreadPenalty + depthBonus + volPenalty) / 3) * 100);
}

function trustLabel(score) {
  if (score == null) return { label: "Unknown", color: null };
  if (score >= 75) return { label: "High Trust", color: "yes" };
  if (score >= 45) return { label: "Moderate", color: "warn" };
  return { label: "Low Trust", color: "no" };
}

// ─── TRANSLATOR NARRATION ──────────────────────��──────────────────────────────
function narrateFill(fill, marketName, szDecimals) {
  const size = scaleSize(fill.sz, szDecimals);
  const price = parseFloat(fill.px);
  const value = size != null ? size * price : null;
  const side = fill.side === "B" ? "bought YES" : "sold YES (bet NO)";
  const prob = (price * 100).toFixed(1);
  const emoji = fill.side === "B" ? "🟢" : "🔴";
  const addr = shortAddr(fill.user || fill.oid?.toString());
  return {
    id: fill.oid || Math.random(),
    text: `${emoji} ${addr} ${side} ${size != null ? fmtNum(size, 2) : "?"} contracts on "${marketName}" @ ${fmtNum(price, 4)} (${prob}% implied), worth ${value != null ? fmtUSD(value) : "N/A"}.`,
    side: fill.side,
    ts: fill.time || Date.now(),
    price,
    size,
    value,
    market: marketName,
  };
}

// ─── DATA BADGE ──────────────────────────────────────────────────────────────
function DataBadge({ t }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1,
      padding: "2px 6px", borderRadius: 3,
      background: t.accentSoft, color: t.textMuted, border: `1px solid ${t.border}`,
    }}>DATA PENDING</span>
  );
}

// ─── TRUST GAUGE ─────────────────────────────────────────────────────────────
function TrustGauge({ score, t }) {
  const { label, color } = trustLabel(score);
  const clr = color ? t[color] : t.textMuted;
  const pct = score ?? 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 120, height: 64 }}>
        <svg width={120} height={64} viewBox="0 0 120 64">
          <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke={t.border} strokeWidth={10} strokeLinecap="round" />
          <path
            d="M10 60 A50 50 0 0 1 110 60"
            fill="none" stroke={clr} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 157} 157`}
            style={{ filter: `drop-shadow(0 0 6px ${clr})`, transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
          fontSize: 28, fontWeight: 900, color: clr, fontFamily: "monospace",
          textShadow: `0 0 12px ${clr}`,
        }}>
          {score ?? "?"}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: clr, letterSpacing: 1 }}>{label.toUpperCase()}</div>
    </div>
  );
}

// (snip—rest is unchanged from your code, everything stays as in your dashboard code!)

// ─── MARKET HEALTH CARD ───────────────────────────────────────────────────────
/* ... as in your code ... */

// ─── WHALE SIEVE ──────────────────────────────────────────────────────────────
/* ... as in your code ... */

// ─── TRANSLATOR FEED ──────────────────────────────────────────────────────────
/* ... as in your code ... */

// ─── MARKET SELECTOR ─────────────────────────────────────────────────────────
/* ... as in your code ... */

// ─── STATUS BAR ──────────────────────────────────────────────────────────────
/* ... as in your code ... */

// ─── MOCK DATA GENERATOR (fallback when API is limited) ───────────────────────
/* ... as in your code ... */

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function OutcomerGen() {
  // PASTE ALL YOUR HOOKS (useState, useEffect) HERE
  
  return (
    // PASTE YOUR ENTIRE <div style=...> BLOCK HERE
  );
}

// ─── VITE ENTRY POINT ──────────────────────────────────────────────────────────
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<OutcomerGen />);
        }
