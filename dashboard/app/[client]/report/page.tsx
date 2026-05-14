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

function fmt(n: number | null) {
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

  // Auto-print once data loads
  useEffect(() => {
    if (!loading && posts.length >= 0 && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [loading, posts]);

  const totalViews    = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes    = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0);
  const totalPosts    = posts.length;
  const avgViews      = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0;

  // CPI for the period
  const retainer = MONTHLY_RETAINER[client] ?? 0;
  const days = from && to
    ? Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24) + 1)
    : 30;
  const periodRetainer = retainer * (days / 30);
  const cpi = retainer > 0 && totalViews > 0 ? periodRetainer / totalViews : null;

  // Top 5 posts by views
  const topPosts = [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  // Weekly bar chart data
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
  const maxViews = Math.max(...weekData.map(w => w.views), 1);

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

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 32 }}>
          <div>
            <div style={{ color: PINK, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Creator Camp
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {clientName} Analytics
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

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: cpi ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 12, marginBottom: 36 }}>
          {[
            { label: "Posts", value: totalPosts },
            { label: "Total Views", value: fmt(totalViews) },
            { label: "Total Likes", value: fmt(totalLikes) },
            { label: "Avg Views", value: fmt(avgViews) },
            ...(cpi ? [{ label: "CPI", value: `$${cpi.toFixed(3)}` }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Bar Chart */}
        {weekData.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px 28px", marginBottom: 36 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
              Views by Week
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
              {weekData.map(w => (
                <div key={w.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: "100%", background: PINK, borderRadius: "4px 4px 0 0", height: `${Math.max(4, (w.views / maxViews) * 100)}px`, transition: "height 0.3s" }} />
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, whiteSpace: "nowrap" }}>{w.week}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Posts */}
        {topPosts.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              Top Posts
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {topPosts.map((p, i) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr 80px 80px 80px", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 600 }}>{i + 1}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.caption || "—"}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Views</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(p.views)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Likes</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{fmt(p.likes)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {p.post_url
                      ? <a href={p.post_url} style={{ color: PINK, fontSize: 11, textDecoration: "none" }}>↗ View</a>
                      : <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 11 }}>—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
            Prepared by Creator Camp · creatorcamp.co
          </div>
          <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 11 }}>
            {totalPosts} posts · {fmt(totalViews)} views · {fmt(totalLikes)} likes
          </div>
        </div>

        {/* Print button (hidden when printing) */}
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
