"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";

const PINK = "#E82E6A";

const MONTHLY_RETAINER: Record<string, number> = {
  cosmos: 40000,
  poke:   35000,
  wabi:   35000,
  yahoo:  0,
  olive:  15000,
};

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  instagram: { label: "Instagram", color: "#E1306C" },
  tiktok:    { label: "TikTok",    color: "#69C9D0" },
  twitter:   { label: "Twitter / X", color: "#1D9BF0" },
};

type Post = {
  id: number;
  account: string;
  platform: string;
  post_url: string;
  caption: string;
  post_type: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  posted_date: string | null;
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function cleanDate(d: string | null) {
  if (!d) return "";
  return d.slice(0, 10);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </div>
  );
}

// CC Logo SVG inline
function CCLogo({ size = 44 }: { size?: number }) {
  const w = size * (1644 / 709);
  return (
    <svg width={w} height={size} viewBox="0 0 1644 709" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M314.285 354.065C308.245 353.716 308.245 344.807 314.285 344.459L793.261 307.716L886.07 0H228.596C198.4 0 171.795 20.1366 163.609 49.2519L2.54251 622.954C-9.5046 666.008 22.7663 708.609 67.5289 708.609H687.075L783.237 363.505L314.285 354.065Z" fill="white"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M1437.38 380.975L1510.38 475.146L1540.75 366.992L1437.38 380.975Z" fill="white"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M1408.61 413.978L1384.82 646.883C1384.25 652.453 1376.18 652.584 1375.43 647.04L1343.56 411.389L1225.73 502.727C1221.53 505.987 1216.15 500.522 1219.47 496.372L1310.56 382.613L1077.65 358.824C1072.08 358.258 1071.95 350.186 1077.49 349.436L1313.14 317.566L1221.81 199.736C1218.55 195.535 1224.01 190.156 1228.16 193.477L1341.92 284.563L1365.71 51.6579C1366.28 46.0876 1374.35 45.9568 1375.1 51.501L1406.97 287.152L1524.8 195.813C1529 192.553 1534.38 198.019 1531.06 202.168L1439.97 315.927L1551.88 327.355L1643.81 0H986.338C956.142 0 929.537 20.1366 921.352 49.2519L760.285 622.954C748.238 666.008 780.508 708.609 825.271 708.609H1444.82L1505.72 491.726L1408.61 413.969L1408.61 413.978Z" fill="white"/>
    </svg>
  );
}

export default function ReportPage() {
  const { client } = useParams<{ client: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to") ?? "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [priorPosts, setPriorPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Options
  const clientName = client.charAt(0).toUpperCase() + client.slice(1);
  const retainer = MONTHLY_RETAINER[client] ?? 0;
  const [showCPI, setShowCPI] = useState(retainer > 0);
  const [showChart, setShowChart] = useState(true);

  // Fetch current period
  useEffect(() => {
    if (!from || !to) return;
    fetch(`/api/report?client=${clientName}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { setPosts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientName, from, to]);

  // Fetch prior 4 weeks for chart context (non-blocking)
  useEffect(() => {
    if (!from) return;
    const priorTo = new Date(from + "T12:00:00");
    priorTo.setDate(priorTo.getDate() - 1);
    const priorFrom = new Date(from + "T12:00:00");
    priorFrom.setDate(priorFrom.getDate() - 28);
    const pf = priorFrom.toISOString().slice(0, 10);
    const pt = priorTo.toISOString().slice(0, 10);
    fetch(`/api/report?client=${clientName}&from=${pf}&to=${pt}`)
      .then(r => r.json())
      .then(d => setPriorPosts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [clientName, from]);

  // ── Totals ──
  const totalViews    = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes    = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalPosts    = posts.length;
  const avgViews      = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0;

  // ── CPI ──
  const days = from && to
    ? Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24) + 1)
    : 30;
  const periodRetainer = retainer * (days / 30);
  const cpi = retainer > 0 && totalViews > 0 ? periodRetainer / totalViews : null;

  // ── Platform breakdown ──
  const platforms = ["instagram", "tiktok", "twitter"] as const;
  const byPlatform = Object.fromEntries(
    platforms.map(pl => {
      const pl_posts = posts.filter(p => p.platform === pl);
      return [pl, {
        posts:  pl_posts.length,
        views:  pl_posts.reduce((s, p) => s + (p.views ?? 0), 0),
        likes:  pl_posts.reduce((s, p) => s + (p.likes ?? 0), 0),
      }];
    })
  );
  const activePlatforms = platforms.filter(pl => byPlatform[pl].posts > 0);

  // ── All posts sorted by date ──
  const sortedPosts = [...posts].sort((a, b) => {
    const da = a.posted_date ?? "";
    const db = b.posted_date ?? "";
    return db.localeCompare(da);
  });

  // ── Weekly line chart ──
  function toWeekKey(dateStr: string | null) {
    if (!dateStr) return null;
    const d = new Date(cleanDate(dateStr));
    const ws = new Date(d);
    ws.setDate(d.getDate() - d.getDay());
    return ws.toISOString().slice(5, 10);
  }

  const byPriorWeek: Record<string, number> = {};
  for (const p of priorPosts) {
    const key = toWeekKey(p.posted_date);
    if (!key) continue;
    byPriorWeek[key] = (byPriorWeek[key] ?? 0) + (p.views ?? 0);
  }
  const priorWeekData = Object.keys(byPriorWeek).sort().map(k => ({ week: k, views: byPriorWeek[k], isPrior: true }));

  const byWeek: Record<string, number> = {};
  for (const p of posts) {
    const key = toWeekKey(p.posted_date);
    if (!key) continue;
    byWeek[key] = (byWeek[key] ?? 0) + (p.views ?? 0);
  }
  const currentWeekData = Object.keys(byWeek).sort().map(k => ({ week: k, views: byWeek[k], isPrior: false }));

  const weekData = [...priorWeekData, ...currentWeekData]
    .filter((w, i, arr) => arr.findIndex(x => x.week === w.week) === i)
    .sort((a, b) => a.week.localeCompare(b.week));
  const n = weekData.length;

  const trendPoints = (() => {
    if (n < 2) return null;
    const xs = weekData.map((_, i) => i);
    const ys = weekData.map(w => w.views);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0);
    const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    const trendDir = slope > 0 ? "↑" : slope < 0 ? "↓" : "→";
    return { y0: intercept, y1: slope * (n - 1) + intercept, dir: trendDir, slope };
  })();

  if (loading) {
    return (
      <div style={{ background: "#000", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        Generating report...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.45in; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #000 !important; }
          .no-print { display: none !important; }
          html, body { background: #000 !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>

      {/* ── Options Bar (no-print) ── */}
      <div className="no-print" style={{
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 40px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Report Options
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
          <input type="checkbox" checked={showCPI} onChange={e => setShowCPI(e.target.checked)}
            disabled={retainer === 0}
            style={{ accentColor: PINK, cursor: "pointer" }} />
          Include CPI
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
          <input type="checkbox" checked={showChart} onChange={e => setShowChart(e.target.checked)}
            style={{ accentColor: PINK, cursor: "pointer" }} />
          Show Performance Chart
        </label>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={() => window.print()}
            style={{ background: PINK, color: "#fff", border: "none", borderRadius: 999, padding: "8px 22px", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" }}>
            ↓ Download PDF
          </button>
        </div>
      </div>

      {/* ── Report Content ── */}
      <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: "36px 52px 40px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 24 }}>
          <div>
            <div style={{ color: PINK, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
              Creator Camp
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 3 }}>
              {clientName} Weekly Report
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
              {from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <CCLogo size={38} />
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
              {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* ── Summary Stat Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: (cpi && showCPI) ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Posts",       value: totalPosts },
            { label: "Total Views", value: fmt(totalViews) },
            { label: "Total Likes", value: fmt(totalLikes) },
            { label: "Avg Views",   value: fmt(avgViews) },
            ...((cpi && showCPI) ? [{ label: "CPI", value: `$${cpi.toFixed(3)}` }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Platform Breakdown ── */}
        {activePlatforms.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>Platform Breakdown</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${activePlatforms.length}, 1fr)`, gap: 10 }}>
              {activePlatforms.map(pl => {
                const cfg = PLATFORM_CONFIG[pl];
                const data = byPlatform[pl];
                return (
                  <div key={pl} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{cfg.label}</div>
                      <div style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{data.posts} posts</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Views", value: fmt(data.views) },
                        { label: "Likes", value: fmt(data.likes) },
                      ].map(s => (
                        <div key={s.label}>
                          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Weekly Performance Line Chart ── */}
        {showChart && weekData.length >= 1 && (() => {
          const W = 796, H = 140, PAD = { top: 16, right: 16, bottom: 26, left: 46 };
          const innerW = W - PAD.left - PAD.right;
          const innerH = H - PAD.top - PAD.bottom;
          const maxV = Math.max(...weekData.map(w => w.views), 1);
          const xOf = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * innerW;
          const yOf = (v: number) => PAD.top + (1 - Math.max(0, v) / maxV) * innerH;

          const lastPriorIdx = weekData.reduce((acc, w, i) => w.isPrior ? i : acc, -1);
          const firstCurrentIdx = weekData.findIndex(w => !w.isPrior);

          const priorPath = weekData
            .filter(w => w.isPrior)
            .map((w, i) => `${i === 0 ? "M" : "L"}${xOf(weekData.indexOf(w)).toFixed(1)},${yOf(w.views).toFixed(1)}`)
            .join(" ");

          const bridgePath = lastPriorIdx >= 0 && firstCurrentIdx >= 0
            ? `M${xOf(lastPriorIdx).toFixed(1)},${yOf(weekData[lastPriorIdx].views).toFixed(1)} L${xOf(firstCurrentIdx).toFixed(1)},${yOf(weekData[firstCurrentIdx].views).toFixed(1)}`
            : "";

          const currentPath = weekData
            .map((w, i) => ({ w, i }))
            .filter(({ w }) => !w.isPrior)
            .map(({ w, i }, j) => `${j === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(w.views).toFixed(1)}`)
            .join(" ");

          const currentIndices = weekData.map((w, i) => ({ w, i })).filter(({ w }) => !w.isPrior);
          const areaPath = currentIndices.length > 1
            ? `${currentPath} L${xOf(currentIndices[currentIndices.length-1].i).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${xOf(currentIndices[0].i).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`
            : "";

          const yTicks = [0, 0.5, 1].map(t => Math.round(t * maxV));
          const trendColor = trendPoints
            ? trendPoints.slope > 0 ? "#4ade80" : trendPoints.slope < 0 ? "#f87171" : "rgba(255,255,255,0.3)"
            : "rgba(255,255,255,0.3)";

          return (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <SectionLabel>Weekly Performance</SectionLabel>
                {trendPoints && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: trendColor }}>
                    {trendPoints.dir} {trendPoints.slope > 0 ? "Trending up" : trendPoints.slope < 0 ? "Trending down" : "Flat"}
                  </div>
                )}
              </div>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
                {yTicks.map(v => (
                  <g key={v}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    <text x={PAD.left - 5} y={yOf(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="8">{fmt(v)}</text>
                  </g>
                ))}
                {firstCurrentIdx > 0 && (
                  <line x1={xOf(firstCurrentIdx)} x2={xOf(firstCurrentIdx)} y1={PAD.top} y2={PAD.top + innerH}
                    stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3" />
                )}
                {trendPoints && n > 1 && (
                  <line x1={xOf(0)} y1={yOf(Math.max(0, trendPoints.y0))} x2={xOf(n - 1)} y2={yOf(Math.max(0, trendPoints.y1))}
                    stroke={trendColor} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.5" />
                )}
                {areaPath && <path d={areaPath} fill={`${PINK}20`} />}
                {priorPath && <path d={priorPath} fill="none" stroke={PINK} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.35" strokeLinejoin="round" strokeLinecap="round" />}
                {bridgePath && <path d={bridgePath} fill="none" stroke={PINK} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.35" />}
                {currentPath && <path d={currentPath} fill="none" stroke={PINK} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
                {weekData.map((w, i) => {
                  const isLast = i === n - 1;
                  const isPrior = w.isPrior;
                  const r = isLast ? 6 : isPrior ? 2.5 : 4;
                  const opacity = isPrior ? 0.4 : 1;
                  const showLabel = n <= 10 || i === 0 || i % Math.ceil(n / 7) === 0 || isLast || i === firstCurrentIdx;
                  return (
                    <g key={w.week}>
                      {isLast && <circle cx={xOf(i)} cy={yOf(w.views)} r="12" fill={PINK} opacity="0.12" />}
                      {isLast && <circle cx={xOf(i)} cy={yOf(w.views)} r="8" fill={PINK} opacity="0.2" />}
                      <circle cx={xOf(i)} cy={yOf(w.views)} r={r} fill={PINK} opacity={opacity} />
                      {showLabel && (
                        <text x={xOf(i)} y={H - 4} textAnchor="middle"
                          fill={isLast ? "rgba(255,255,255,0.6)" : isPrior ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.4)"}
                          fontSize="8" fontWeight={isLast ? "700" : "400"}>{w.week}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 14, height: 2, background: PINK, borderRadius: 2 }} />
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>This period</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke={PINK} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.4" /></svg>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>Prior 4 weeks</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke={trendColor} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" /></svg>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>Trend</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── All Posts ── */}
        {sortedPosts.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>All Posts ({sortedPosts.length})</SectionLabel>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "10px 8px 80px 1fr 58px 52px 52px 44px", gap: 8, alignItems: "center", padding: "5px 0 5px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 1 }}>
              <div />
              <div />
              <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Date</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Caption</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>Views</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>Likes</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>Cmts</div>
              <div />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sortedPosts.map((p, i) => {
                const plCfg = PLATFORM_CONFIG[p.platform];
                return (
                  <div key={p.id} style={{
                    display: "grid",
                    gridTemplateColumns: "10px 8px 80px 1fr 58px 52px 52px 44px",
                    gap: 8,
                    alignItems: "center",
                    padding: "5px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                  }}>
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, fontWeight: 600 }}>{i + 1}</div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: plCfg?.color ?? "#888", flexShrink: 0 }} />
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                      {p.posted_date ? fmtDate(cleanDate(p.posted_date)) : "—"}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.caption || "—"}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, textAlign: "right" }}>{fmt(p.views)}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", textAlign: "right" }}>{fmt(p.likes)}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", textAlign: "right" }}>{fmt(p.comments)}</div>
                    <div style={{ textAlign: "right" }}>
                      {p.post_url
                        ? <a href={p.post_url} style={{ color: PINK, fontSize: 9, textDecoration: "none" }}>↗</a>
                        : <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 9 }}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
            Prepared by Creator Camp · creatorcamp.co
          </div>
          <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>
            {totalPosts} posts · {fmt(totalViews)} views · {fmt(totalLikes)} likes
          </div>
        </div>

      </div>
    </>
  );
}
