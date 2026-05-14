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
    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
      {children}
    </div>
  );
}

export default function ReportPage() {
  const { client } = useParams<{ client: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to") ?? "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const printed = useRef(false);

  const clientName = client.charAt(0).toUpperCase() + client.slice(1);

  useEffect(() => {
    if (!from || !to) return;
    fetch(`/api/report?client=${clientName}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { setPosts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientName, from, to]);

  useEffect(() => {
    if (!loading && posts.length >= 0 && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [loading, posts]);

  // ── Totals ──
  const totalViews    = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes    = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalPosts    = posts.length;
  const avgViews      = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0;

  // ── CPI ──
  const retainer = MONTHLY_RETAINER[client] ?? 0;
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

  // ── Top 5 posts ──
  const topPosts = [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  // ── Weekly line chart ──
  const byWeek: Record<string, number> = {};
  for (const p of posts) {
    if (!p.posted_date) continue;
    const d = new Date(cleanDate(p.posted_date));
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(5, 10);
    byWeek[key] = (byWeek[key] ?? 0) + (p.views ?? 0);
  }
  const weekData = Object.keys(byWeek).sort().map(k => ({ week: k, views: byWeek[k] }));
  const n = weekData.length;

  // Linear regression
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
          @page { margin: 0.6in; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>

      <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: "48px 52px", maxWidth: 900, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 32 }}>
          <div>
            <div style={{ color: PINK, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Creator Camp
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {clientName} Weekly Report
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              {from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: PINK, marginLeft: "auto", marginBottom: 4 }} />
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
              {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* ── Summary Stat Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: cpi ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 12, marginBottom: 36 }}>
          {[
            { label: "Posts",       value: totalPosts },
            { label: "Total Views", value: fmt(totalViews) },
            { label: "Total Likes", value: fmt(totalLikes) },
            { label: "Avg Views",   value: fmt(avgViews) },
            ...(cpi ? [{ label: "CPI", value: `$${cpi.toFixed(3)}` }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Platform Breakdown ── */}
        {activePlatforms.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <SectionLabel>Platform Breakdown</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${activePlatforms.length}, 1fr)`, gap: 12 }}>
              {activePlatforms.map(pl => {
                const cfg = PLATFORM_CONFIG[pl];
                const data = byPlatform[pl];
                return (
                  <div key={pl} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
                    {/* Platform header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{cfg.label}</div>
                      <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{data.posts} posts</div>
                    </div>
                    {/* Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Views", value: fmt(data.views) },
                        { label: "Likes", value: fmt(data.likes) },
                      ].map(s => (
                        <div key={s.label}>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
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
        {weekData.length > 1 && (() => {
          const W = 796, H = 160, PAD = { top: 16, right: 16, bottom: 28, left: 48 };
          const innerW = W - PAD.left - PAD.right;
          const innerH = H - PAD.top - PAD.bottom;
          const maxV = Math.max(...weekData.map(w => w.views), 1);
          const xOf = (i: number) => PAD.left + (i / (n - 1)) * innerW;
          const yOf = (v: number) => PAD.top + (1 - v / maxV) * innerH;
          const linePath = weekData.map((w, i) =>
            `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(w.views).toFixed(1)}`
          ).join(" ");
          const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(t * maxV));
          const trendColor = trendPoints
            ? trendPoints.slope > 0 ? "#4ade80" : trendPoints.slope < 0 ? "#f87171" : "rgba(255,255,255,0.3)"
            : "rgba(255,255,255,0.3)";

          return (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px 28px", marginBottom: 36 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <SectionLabel>Weekly Performance</SectionLabel>
                {trendPoints && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: trendColor }}>
                    {trendPoints.dir} {trendPoints.slope > 0 ? "Trending up" : trendPoints.slope < 0 ? "Trending down" : "Flat"}
                  </div>
                )}
              </div>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
                {yTicks.map(v => (
                  <g key={v}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    <text x={PAD.left - 6} y={yOf(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9">{fmt(v)}</text>
                  </g>
                ))}
                {trendPoints && (
                  <line x1={xOf(0)} y1={yOf(Math.max(0, trendPoints.y0))} x2={xOf(n - 1)} y2={yOf(Math.max(0, trendPoints.y1))}
                    stroke={trendColor} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.6" />
                )}
                <path d={`${linePath} L${xOf(n-1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${xOf(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`}
                  fill={`${PINK}22`} />
                <path d={linePath} fill="none" stroke={PINK} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {weekData.map((w, i) => (
                  <g key={w.week}>
                    <circle cx={xOf(i)} cy={yOf(w.views)} r="4" fill={PINK} />
                    {(n <= 8 || i % Math.ceil(n / 8) === 0 || i === n - 1) && (
                      <text x={xOf(i)} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9">{w.week}</text>
                    )}
                  </g>
                ))}
              </svg>
              <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 16, height: 2.5, background: PINK, borderRadius: 2 }} />
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Weekly views</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={trendColor} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7" /></svg>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Trend</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Top Posts ── */}
        {topPosts.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <SectionLabel>Top Posts</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {topPosts.map((p, i) => {
                const plCfg = PLATFORM_CONFIG[p.platform];
                return (
                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "20px 12px 1fr 72px 72px 72px 60px", gap: 10, alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 600 }}>{i + 1}</div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: plCfg?.color ?? "#888", flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.caption || "—"}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Views</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(p.views)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Likes</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{fmt(p.likes)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Comments</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{fmt(p.comments)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {p.post_url
                        ? <a href={p.post_url} style={{ color: PINK, fontSize: 11, textDecoration: "none" }}>↗ View</a>
                        : <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 11 }}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Additional Metrics (placeholders) ── */}
        <div style={{ marginBottom: 36 }}>
          <SectionLabel>Additional Metrics</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "ManyChat", sub: "Impressions · Clicks", note: "Integration coming soon" },
              { label: "Link Clicks", sub: "dub.co · Conversions", note: "Provided by client" },
            ].map(m => (
              <div key={m.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{m.sub}</div>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>{m.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
            Prepared by Creator Camp · creatorcamp.co
          </div>
          <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 11 }}>
            {totalPosts} posts · {fmt(totalViews)} views · {fmt(totalLikes)} likes
          </div>
        </div>

        {/* Print button */}
        <div className="no-print" style={{ marginTop: 32, textAlign: "center" }}>
          <button onClick={() => window.print()}
            style={{ background: PINK, color: "#fff", border: "none", borderRadius: 999, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save as PDF
          </button>
        </div>

      </div>
    </>
  );
}
