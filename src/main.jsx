import { useState, useEffect, useCallback, useRef } from "react";
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

// ─── TRANSLATOR NARRATION ─────────────────────────────────────────────────────
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

// ─── STAT ROW ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, accent, t, pending }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${t.border}40` }}>
      <span style={{ fontSize: 11, color: t.textMuted, letterSpacing: 0.5 }}>{label}</span>
      {pending ? <DataBadge t={t} /> : (
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: accent || t.text }}>{value}</span>
      )}
    </div>
  );
}

// ─── MARKET HEALTH CARD ───────────────────────────────────────────────────────
function MarketHealthCard({ market, t }) {
  if (!market) return null;
  const { name, bestBid, bestAsk, spread, depth, trustScore, szDecimals, coin } = market;

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: 20,
      boxShadow: t.glow,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, marginBottom: 4 }}>MARKET HEALTH</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text, maxWidth: 180, lineHeight: 1.3 }}>{name || coin}</div>
        </div>
        <TrustGauge score={trustScore} t={t} />
      </div>
      <StatRow label="Best Bid" value={bestBid != null ? fmtNum(bestBid) : null} accent={t.yes} t={t} pending={bestBid == null} />
      <StatRow label="Best Ask" value={bestAsk != null ? fmtNum(bestAsk) : null} accent={t.no} t={t} pending={bestAsk == null} />
      <StatRow label="Spread" value={spread != null ? fmtNum(spread, 4) : null} accent={t.warn} t={t} pending={spread == null} />
      <StatRow label="Liquidity Depth" value={depth != null ? fmtUSD(depth) : null} t={t} pending={depth == null} />
      <StatRow label="Size Decimals" value={szDecimals ?? "—"} t={t} pending={szDecimals == null} />
    </div>
  );
}

// ─── WHALE SIEVE ──────────────────────────────────────────────────────────────
function WhaleSieve({ whales, t }) {
  if (!whales || whales.length === 0) {
    return (
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, boxShadow: t.glow }}>
        <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, marginBottom: 12 }}>WHALE SIEVE</div>
        <div style={{ color: t.textMuted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
          <Fish size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>No whale positions detected</div>
          <DataBadge t={t} />
        </div>
      </div>
    );
  }

  const total = whales.reduce((s, w) => s + (w.size || 0), 0);
  const chartData = whales.slice(0, 6).map(w => ({
    name: shortAddr(w.address),
    pct: total > 0 ? (w.size / total) * 100 : 0,
    side: w.side,
  }));

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, boxShadow: t.glow }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Fish size={14} color={t.accent} />
        <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2 }}>WHALE SIEVE — TOP HOLDERS</div>
      </div>
      <div style={{ height: 100, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="20%">
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: t.textMuted }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: t.text }}
              formatter={(v) => [v.toFixed(1) + "%", "Share"]}
            />
            <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.side === "B" ? t.yes : t.no} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {whales.slice(0, 5).map((w, i) => {
          const pct = total > 0 ? (w.size / total) * 100 : 0;
          const isWhale = pct >= 2;
          return (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 8px", borderRadius: 6,
              background: isWhale ? t.accentSoft : "transparent",
              border: isWhale ? `1px solid ${t.accent}40` : `1px solid ${t.border}30`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isWhale && <Zap size={10} color={t.accent} />}
                <span style={{ fontSize: 11, fontFamily: "monospace", color: isWhale ? t.accent : t.textDim }}>
                  {shortAddr(w.address)}
                </span>
                <span style={{
                  fontSize: 9, padding: "1px 5px", borderRadius: 3,
                  background: w.side === "B" ? t.yes + "25" : t.no + "25",
                  color: w.side === "B" ? t.yes : t.no, fontWeight: 700,
                }}>
                  {w.side === "B" ? "YES" : "NO"}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: t.text }}>{pct.toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{fmtNum(w.size, 2)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TRANSLATOR FEED ──────────────────────────────────────────────────────────
function TranslatorFeed({ entries, t }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [entries.length]);

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, boxShadow: t.glow }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <MessageSquare size={14} color={t.accent} />
        <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2 }}>ON-CHAIN TRANSLATOR — LIVE FEED</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <Circle size={6} color={t.yes} fill={t.yes} style={{ animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: t.yes, letterSpacing: 1 }}>LIVE</span>
        </div>
      </div>
      <div ref={scrollRef} style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.length === 0 ? (
          <div style={{ color: t.textMuted, fontSize: 13, textAlign: "center", padding: "32px 0" }}>
            <Activity size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Awaiting on-chain activity…</div>
            <DataBadge t={t} />
          </div>
        ) : entries.map((e) => (
          <div key={e.id} style={{
            padding: "10px 12px", borderRadius: 8,
            background: e.side === "B" ? t.yes + "10" : t.no + "10",
            border: `1px solid ${e.side === "B" ? t.yes + "30" : t.no + "30"}`,
            transition: "all 0.3s ease",
          }}>
            <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5, fontFamily: "monospace" }}>{e.text}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: t.textMuted }}>
                {e.ts ? new Date(e.ts).toLocaleTimeString() : "—"}
              </span>
              {e.value != null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: e.side === "B" ? t.yes : t.no }}>
                  {fmtUSD(e.value)} total
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MARKET SELECTOR ─────────────────────────────────────────────────────────
function MarketSelector({ markets, selected, onSelect, t }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {markets.map((m) => (
        <button key={m.coin} onClick={() => onSelect(m)} style={{
          padding: "6px 14px", borderRadius: 6, cursor: "pointer",
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fontFamily: "monospace",
          background: selected?.coin === m.coin ? t.accent : t.badge,
          color: selected?.coin === m.coin ? t.bg : t.textDim,
          border: `1px solid ${selected?.coin === m.coin ? t.accent : t.border}`,
          transition: "all 0.2s",
        }}>
          {m.coin}
        </button>
      ))}
    </div>
  );
}

// ─── STATUS BAR ──────────────────────────────────────────────────────────────
function StatusBar({ loading, error, lastFetch, t }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "6px 12px", borderRadius: 6,
      background: error ? t.no + "15" : t.accentSoft,
      border: `1px solid ${error ? t.no + "40" : t.accent + "30"}`,
      fontSize: 10, color: t.textMuted,
    }}>
      {loading ? (
        <RefreshCw size={10} color={t.accent} style={{ animation: "spin 1s linear infinite" }} />
      ) : error ? (
        <AlertTriangle size={10} color={t.no} />
      ) : (
        <Circle size={6} color={t.yes} fill={t.yes} />
      )}
      <span style={{ color: error ? t.no : t.textDim, letterSpacing: 0.5 }}>
        {loading ? "FETCHING…" : error ? `ERROR: ${error}` : `SYNCED ${lastFetch ? new Date(lastFetch).toLocaleTimeString() : ""}`}
      </span>
    </div>
  );
}

// ─── MOCK DATA GENERATOR (fallback when API is limited) ───────────────────────
function generateMockData(coin) {
  const bid = 0.55 + Math.random() * 0.15;
  const ask = bid + 0.02 + Math.random() * 0.05;
  const spread = ask - bid;
  const depth = 5000 + Math.random() * 50000;
  const vol = 0.01 + Math.random() * 0.05;
  const trustScore = calcTrustScore({ spread, depth, volatility: vol });

  const fills = Array.from({ length: 8 }, (_, i) => ({
    oid: Math.random(),
    sz: (100 + Math.random() * 900).toFixed(0),
    px: (bid + Math.random() * spread).toFixed(4),
    side: Math.random() > 0.5 ? "B" : "A",
    user: "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, "0"),
    time: Date.now() - i * 45000,
  }));

  const whaleAddrs = Array.from({ length: 7 }, () => "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, "0"));
  const whales = whaleAddrs.map(addr => ({
    address: addr,
    size: 500 + Math.random() * 8000,
    side: Math.random() > 0.45 ? "B" : "A",
  })).sort((a, b) => b.size - a.size);

  return { bid, ask, spread, depth, trustScore, fills, whales, szDecimals: 2 };
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function OutcomerGen() {
  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme];

  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [translatorFeed, setTranslatorFeed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [useMock, setUseMock] = useState(false);

  // Fetch market list
  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meta = await hlPost({ type: "meta" });
      const universe = meta?.universe || [];
      // HIP-4: binary markets have szDecimals for outcome tokens
      const outcomeMarkets = universe.map((m, i) => ({
        coin: m.name,
        szDecimals: m.szDecimals ?? 2,
        index: i,
        rawMeta: m,
      }));
      setMarkets(outcomeMarkets.slice(0, 20));
      if (outcomeMarkets.length > 0) setSelectedMarket(outcomeMarkets[0]);
      setUseMock(false);
    } catch (e) {
      // CORS or network issue — fall back to mock
      const mockMarkets = ["BTC-OUTCOME", "ETH-OUTCOME", "SOL-OUTCOME", "DOGE-OUTCOME"].map(name => ({
        coin: name, szDecimals: 2, index: 0, rawMeta: {},
      }));
      setMarkets(mockMarkets);
      setSelectedMarket(mockMarkets[0]);
      setUseMock(true);
      setError("API unreachable — showing demo data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch per-market data
  const fetchMarketData = useCallback(async (market) => {
    if (!market) return;
    setLoading(true);
    try {
      if (useMock) {
        const mock = generateMockData(market.coin);
        setMarketData({
          name: market.coin,
          coin: market.coin,
          szDecimals: market.szDecimals,
          bestBid: mock.bid,
          bestAsk: mock.ask,
          spread: mock.spread,
          depth: mock.depth,
          trustScore: mock.trustScore,
        });
        const feed = mock.fills.map(f => narrateFill(f, market.coin, market.szDecimals));
        setTranslatorFeed(feed);

        const whales = mock.whales;
        setMarketData(prev => ({ ...prev, _whales: whales }));
        setLastFetch(Date.now());
        setLoading(false);
        return;
      }

      // Real API calls
      const [l2, openOrders] = await Promise.allSettled([
        hlPost({ type: "l2Book", coin: market.coin }),
        hlPost({ type: "frontendOpenOrders", user: "0x0000000000000000000000000000000000000000" }),
      ]);

      let bestBid = null, bestAsk = null, spread = null, depth = null;
      if (l2.status === "fulfilled" && l2.value?.levels) {
        const levels = l2.value.levels;
        const bids = levels[0] || [];
        const asks = levels[1] || [];
        if (bids.length > 0) bestBid = parseFloat(bids[0].px);
        if (asks.length > 0) bestAsk = parseFloat(asks[0].px);
        if (bestBid && bestAsk) spread = bestAsk - bestBid;
        depth = [...bids, ...asks].reduce((s, lvl) => s + (scaleSize(lvl.sz, market.szDecimals) || 0) * parseFloat(lvl.px), 0);
      }

      const trustScore = calcTrustScore({ spread, depth, volatility: 0.02 });

      setMarketData({
        name: market.coin,
        coin: market.coin,
        szDecimals: market.szDecimals,
        bestBid, bestAsk, spread, depth, trustScore,
        _whales: [],
      });

      // Translator: try recent trades
      try {
        const trades = await hlPost({ type: "trades", coin: market.coin });
        if (Array.isArray(trades)) {
          const feed = trades.slice(0, 12).map(tr => ({
            oid: tr.tid || Math.random(),
            sz: tr.sz,
            px: tr.px,
            side: tr.side,
            user: tr.users?.[0] || null,
            time: tr.time,
          })).map(f => narrateFill(f, market.coin, market.szDecimals));
          setTranslatorFeed(feed);
        }
      } catch {}

      setLastFetch(Date.now());
      setError(null);
    } catch (e) {
      setError("Fetch failed — using cached data");
    } finally {
      setLoading(false);
    }
  }, [useMock]);

  useEffect(() => { fetchMarkets(); }, []);
  useEffect(() => { if (selectedMarket) fetchMarketData(selectedMarket); }, [selectedMarket, fetchMarketData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => {
      if (selectedMarket) fetchMarketData(selectedMarket);
    }, 30000);
    return () => clearInterval(id);
  }, [selectedMarket, fetchMarketData]);

  const whales = marketData?._whales || [];

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
      transition: "background 0.3s, color 0.3s",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Scanlines effect (dark mode) */}
      {t.scanline && (
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
        }} />
      )}

      {/* Grid pattern background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        opacity: 0.4,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>

        {/* ─── HEADER ─────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `linear-gradient(135deg, ${t.accent}, ${t.accentDim})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 16px ${t.accent}60`,
              }}>
                <BarChart2 size={16} color={t.bg} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, color: t.text }}>
                  Outcomer<span style={{ color: t.accent }}>Gen</span>
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, letterSpacing: 2 }}>INTELLIGENCE LAYER — OUTCOME.XYZ</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBar loading={loading} error={useMock ? null : error} lastFetch={lastFetch} t={t} />
            {useMock && (
              <span style={{
                fontSize: 9, padding: "3px 7px", borderRadius: 4, letterSpacing: 1,
                background: t.warn + "20", color: t.warn, border: `1px solid ${t.warn}40`,
              }}>DEMO MODE</span>
            )}
            <button onClick={() => selectedMarket && fetchMarketData(selectedMarket)} style={{
              padding: "6px 10px", borderRadius: 6, cursor: "pointer",
              background: t.accentSoft, border: `1px solid ${t.accent}50`, color: t.accent,
              display: "flex", alignItems: "center", gap: 4, fontSize: 10,
            }}>
              <RefreshCw size={10} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              REFRESH
            </button>
            <button onClick={() => setTheme(th => th === "dark" ? "light" : "dark")} style={{
              padding: "6px 12px", borderRadius: 20, cursor: "pointer",
              background: t.badge, border: `1px solid ${t.border}`, color: t.textDim,
              display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700,
              transition: "all 0.2s",
            }}>
              {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
              {theme === "dark" ? "LIGHT" : "DARK"}
            </button>
          </div>
        </div>

        {/* ─── PHASE BADGES ───────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "PHASE 1: FOUNDATION", active: true, icon: <Shield size={10} /> },
            { label: "PHASE 2: INTELLIGENCE", active: false, icon: <Eye size={10} /> },
          ].map(b => (
            <div key={b.label} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: 1,
              background: b.active ? t.accentSoft : t.badge,
              border: `1px solid ${b.active ? t.accent + "60" : t.border}`,
              color: b.active ? t.accent : t.textMuted,
            }}>
              {b.icon}{b.label}
              {!b.active && <span style={{ opacity: 0.5 }}>— COMING SOON</span>}
            </div>
          ))}
        </div>

        {/* ─── MARKET SELECTOR ─────────────────────────────────── */}
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10,
          padding: "12px 16px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 9, color: t.textMuted, letterSpacing: 2, marginBottom: 8 }}>SELECT MARKET</div>
          {markets.length > 0
            ? <MarketSelector markets={markets} selected={selectedMarket} onSelect={setSelectedMarket} t={t} />
            : <DataBadge t={t} />
          }
        </div>

        {/* ─── MAIN GRID ───────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
          {/* Market Health */}
          <div style={{ position: "relative" }}>
            <MarketHealthCard market={marketData} t={t} />
          </div>

          {/* Whale Sieve */}
          <div style={{ position: "relative" }}>
            <WhaleSieve whales={whales} t={t} />
          </div>
        </div>

        {/* Translator Feed — full width */}
        <TranslatorFeed entries={translatorFeed} t={t} />

        {/* ─── FOOTER ─────────────────────────────────────────── */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 9, color: t.textMuted, letterSpacing: 1 }}>
            DATA: HYPERLIQUID TESTNET · HIP-4 BINARY MARKETS · szDecimals NORMALIZED
          </div>
          <div style={{ fontSize: 9, color: t.textMuted }}>
            OUTCOMERGEN CORE v1.0 · PHASE 1
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 4px; }
      `}</style>
    </div>
  );
    }
const rootElement = document.getElementById("root");
if (rootElement) {
  const { createRoot } = await import("react-dom/client");
  createRoot(rootElement).render(<OutcomerGen />);
}

