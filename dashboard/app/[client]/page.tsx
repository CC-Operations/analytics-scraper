"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar,
} from "recharts";

const PINK = "#E82E6A";
const CLIENTS = ["Cosmos", "Poke", "Wabi", "Yahoo", "Olive"];
const PLATFORMS = ["Overview", "Instagram", "TikTok", "Twitter", "ManyChat"];
const TIME_RANGES = ["1D", "1W", "1M", "3M", "All"];

// Monthly retainer per client in USD
const MONTHLY_RETAINER: Record<string, number> = {
  cosmos: 40000,
  poke:   35000,
  wabi:   35000,
  yahoo:  0,
  olive:  15000,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E82E6A",
  tiktok: "#69c9d0",
  twitter: "#1d9bf0",
  manychat: "#7b61ff",
};

const TYPE_COLORS: Record<string, string> = {
  Video: "bg-pink-900/40 text-pink-300 border border-pink-800/40",
  Carousel: "bg-white/5 text-white/60 border border-white/10",
  Image: "bg-white/5 text-white/60 border border-white/10",
  Tweet: "bg-sky-900/40 text-sky-300 border border-sky-800/40",
};

type Post = {
  id: number;
  client: string;
  account: string;
  platform: string;
  shortcode: string;
  post_url: string;
  caption: string;
  post_type: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  posted_date: string | null;
  date_scraped: string;
  excluded: boolean;
};

type ViewMode = "all" | "month";

// ── Export Modal ──────────────────────────────────────────────────────────────

function ExportModal({ client, onClose }: { client: string; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo]     = useState(today);

  function generate() {
    window.open(`/${client}/report?from=${from}&to=${to}`, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="rounded-2xl p-8 w-full max-w-sm" style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()}>
        <h2 className="text-white text-lg font-bold mb-1">Export Report</h2>
        <p className="text-white/40 text-xs mb-6">Select a date range — opens a print-ready one-pager</p>

        <div className="flex flex-col gap-4 mb-6">
          {[["From", from, setFrom], ["To", to, setTo]].map(([label, val, set]) => (
            <div key={label as string}>
              <label className="text-white/50 text-xs uppercase tracking-widest block mb-1.5">{label as string}</label>
              <input type="date" value={val as string} onChange={e => (set as (v: string) => void)(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-white text-sm font-medium outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }} />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/40" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            Cancel
          </button>
          <button onClick={generate} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: PINK }}>
            Generate Report →
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function cleanDate(d: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function filterByRange(posts: Post[], range: string): Post[] {
  if (range === "All") return posts;
  const now = new Date();
  const cutoff = new Date();
  if (range === "1D") cutoff.setDate(now.getDate() - 1);
  else if (range === "1W") cutoff.setDate(now.getDate() - 7);
  else if (range === "1M") cutoff.setMonth(now.getMonth() - 1);
  else if (range === "3M") cutoff.setMonth(now.getMonth() - 3);
  return posts.filter((p) => p.posted_date && new Date(cleanDate(p.posted_date)) >= cutoff);
}

function filterByMonth(posts: Post[]): Post[] {
  const ym = new Date().toISOString().slice(0, 7);
  return posts.filter((p) => p.posted_date && cleanDate(p.posted_date).slice(0, 7) === ym);
}

// ── View Mode Toggle ──────────────────────────────────────────────────────────

function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-1">
      {([["all", "All Time"], ["month", "This Month"]] as [ViewMode, string][]).map(([val, label]) => (
        <button key={val} onClick={() => onChange(val)}
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
          style={mode === val
            ? { backgroundColor: PINK, color: "white" }
            : { color: "rgba(255,255,255,0.4)" }
          }>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-white/10 transition-colors">
      <p className="text-white/60 text-xs uppercase tracking-widest mb-2 font-medium">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

// ── Time Filter ───────────────────────────────────────────────────────────────

function TimeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map((r) => (
        <button key={r} onClick={() => onChange(r)}
          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
          style={value === r
            ? { backgroundColor: PINK, color: "white" }
            : { backgroundColor: "transparent", color: "rgba(255,255,255,0.3)" }
          }>
          {r}
        </button>
      ))}
    </div>
  );
}

// ── Views Chart ───────────────────────────────────────────────────────────────

function ViewsChart({ data, timeRange, onTimeChange }: { data: Post[]; timeRange: string; onTimeChange: (v: string) => void }) {
  const filtered = filterByRange(data, timeRange);

  const byWeek: Record<string, number> = {};
  for (const p of filtered) {
    if (!p.posted_date) continue;
    const d = new Date(cleanDate(p.posted_date));
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(5, 10);
    byWeek[key] = (byWeek[key] ?? 0) + (p.views ?? 0);
  }
  const chartData = Object.keys(byWeek).sort().map((k) => ({ week: k, Views: byWeek[k] }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-white/60 text-xs uppercase tracking-widest font-medium">Views by Week</p>
        <TimeFilter value={timeRange} onChange={onTimeChange} />
      </div>
      {chartData.length === 0
        ? <div className="flex items-center justify-center h-40 text-white/30 text-sm">No data for this period</div>
        : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
                formatter={(v: number) => [fmt(v), "Views"]}
              />
              <Bar dataKey="Views" fill={PINK} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
    </div>
  );
}

// ── CPI Stat ──────────────────────────────────────────────────────────────────

function CPIStat({ allPosts, monthPosts, clientKey, mode }: {
  allPosts: Post[];
  monthPosts: Post[];
  clientKey: string;
  mode: ViewMode;
}) {
  const retainer = MONTHLY_RETAINER[clientKey] ?? 0;
  if (retainer === 0) {
    return <div className="flex items-center justify-center h-full text-white/20 text-sm">No retainer set</div>;
  }

  let cpi: number | null = null;
  let subtitle = "";
  let improved: boolean | null = null;
  let pctChange: number | null = null;

  if (mode === "all") {
    // All-time CPI: total spend (retainer × months active) ÷ total views
    const totalViews = allPosts.reduce((s, p) => s + (p.views ?? 0), 0);
    const dates = allPosts.map(p => cleanDate(p.posted_date)).filter(Boolean).sort();
    if (dates.length > 0 && totalViews > 0) {
      const earliest = new Date(dates[0]);
      const monthsActive = Math.max(1, (Date.now() - earliest.getTime()) / (30 * 24 * 60 * 60 * 1000));
      const totalSpend = retainer * monthsActive;
      cpi = totalSpend / totalViews;
      subtitle = `per view · ${Math.round(monthsActive)} mo tracked`;
    }
    // Month-over-month trend for the arrow
    const byMonth: Record<string, number> = {};
    for (const p of allPosts) {
      if (!p.posted_date || !p.views) continue;
      const m = cleanDate(p.posted_date).slice(0, 7);
      byMonth[m] = (byMonth[m] ?? 0) + p.views;
    }
    const mkeys = Object.keys(byMonth).sort();
    if (mkeys.length >= 2) {
      const cur = mkeys[mkeys.length - 1];
      const prev = mkeys[mkeys.length - 2];
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const effectiveRetainer = (m: string) =>
        m === now.toISOString().slice(0, 7) ? retainer * (now.getDate() / daysInMonth) : retainer;
      const curCPI = effectiveRetainer(cur) / byMonth[cur];
      const prevCPI = effectiveRetainer(prev) / byMonth[prev];
      improved = curCPI < prevCPI;
      pctChange = Math.abs(((curCPI - prevCPI) / prevCPI) * 100);
    }
  } else {
    // This month: prorated retainer ÷ month views
    const monthViews = monthPosts.reduce((s, p) => s + (p.views ?? 0), 0);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const proratedRetainer = retainer * (now.getDate() / daysInMonth);
    if (monthViews > 0) {
      cpi = proratedRetainer / monthViews;
      subtitle = `per view · ${now.toLocaleString("default", { month: "long" })}`;
    }
  }

  if (cpi === null) {
    return <div className="flex items-center justify-center h-full text-white/20 text-sm">No data yet</div>;
  }

  const fmtCPI = (v: number) => v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(3)}`;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
      <p className="text-white/55 text-xs uppercase tracking-widest font-medium">CPI</p>
      <p className="text-6xl font-bold text-white tabular-nums">{fmtCPI(cpi)}</p>
      <p className="text-white/30 text-xs">{subtitle}</p>
      {improved !== null && pctChange !== null && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl leading-none" style={{
            color: improved ? "#22c55e" : "#ef4444",
            filter: `drop-shadow(0 0 10px ${improved ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"})`,
          }}>
            {improved ? "↓" : "↑"}
          </span>
          <span className="text-sm font-medium" style={{ color: improved ? "#22c55e" : "#ef4444" }}>
            {pctChange.toFixed(1)}% vs last month
          </span>
        </div>
      )}
      {mode === "all" && improved === null && (
        <p className="text-white/15 text-xs mt-1">More data next month</p>
      )}
    </div>
  );
}

// ── Toggle (exclude/include) ──────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      title={checked ? "Counting — click to exclude" : "Excluded — click to include"}
      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
      style={{ backgroundColor: checked ? PINK : "rgba(255,255,255,0.1)" }}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

// ── Posts Table ───────────────────────────────────────────────────────────────

function PostsTable({ posts, onToggle }: { posts: Post[]; onToggle: (id: number, excluded: boolean) => void }) {
  if (posts.length === 0)
    return <div className="flex items-center justify-center h-48 text-white/20">No posts yet</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.06] text-white/55 text-xs uppercase tracking-widest">
          <th className="text-center px-4 py-4 font-medium">Count</th>
          <th className="text-left px-4 py-4 font-medium">Date</th>
          <th className="text-left px-4 py-4 font-medium">Account</th>
          <th className="text-left px-4 py-4 font-medium">Platform</th>
          <th className="text-left px-4 py-4 font-medium">Type</th>
          <th className="text-left px-4 py-4 font-medium">Caption</th>
          <th className="text-right px-4 py-4 font-medium">Views</th>
          <th className="text-right px-4 py-4 font-medium">Likes</th>
          <th className="text-right px-4 py-4 font-medium">Comments</th>
          <th className="text-center px-4 py-4 font-medium">Link</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post, i) => (
          <tr key={post.id}
            className={`border-b border-white/[0.04] transition-all ${post.excluded ? "opacity-25" : "hover:bg-white/[0.02]"} ${i === posts.length - 1 ? "border-0" : ""}`}>
            <td className="px-4 py-3 text-center">
              <Toggle checked={!post.excluded} onChange={() => onToggle(post.id, !post.excluded)} />
            </td>
            <td className="px-4 py-3 text-white/60 whitespace-nowrap font-mono text-xs">{cleanDate(post.posted_date) || "—"}</td>
            <td className="px-4 py-3 text-white/60 whitespace-nowrap">{post.account}</td>
            <td className="px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PLATFORM_COLORS[post.platform] ?? "#666" }} />
                {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
              </span>
            </td>
            <td className="px-4 py-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[post.post_type === "Sidecar" ? "Carousel" : post.post_type] ?? "bg-white/5 text-white/40 border border-white/10"}`}>
                {post.post_type === "Sidecar" ? "Carousel" : (post.post_type || "—")}
              </span>
            </td>
            <td className="px-4 py-3 text-white/50 max-w-xs truncate">{post.caption || <span className="text-white/20">—</span>}</td>
            <td className="px-4 py-3 text-right text-white font-semibold">{fmt(post.views)}</td>
            <td className="px-4 py-3 text-right text-white/70 font-medium">{fmt(post.likes)}</td>
            <td className="px-4 py-3 text-right text-white/70 font-medium">{fmt(post.comments)}</td>
            <td className="px-4 py-3 text-center">
              {post.post_url
                ? <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white transition-colors">↗</a>
                : <span className="text-white/10">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientPage() {
  const { client } = useParams<{ client: string }>();
  const clientName = client.charAt(0).toUpperCase() + client.slice(1);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState("Overview");
  const [chartRange1, setChartRange1] = useState("All");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    setLoading(true);
    setActivePlatform("Overview");
    fetch(`/api/posts?client=${clientName}`)
      .then((r) => r.json())
      .then((data) => { setPosts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientName]);

  const availablePlatforms = new Set(posts.map((p) => p.platform));
  const filtered = activePlatform === "Overview" ? posts : posts.filter((p) => p.platform === activePlatform.toLowerCase());

  // All counted posts (no date filter) — always used for CPI all-time
  const allCounted = filtered.filter((p) => !p.excluded);

  // This month's counted posts
  const monthCounted = filterByMonth(allCounted);

  // What the stats + chart show depends on the toggle
  const displayCounted = viewMode === "all" ? allCounted : monthCounted;

  const totalViews = displayCounted.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes = displayCounted.reduce((s, p) => s + (p.likes ?? 0), 0);
  const avgViews = displayCounted.length > 0 ? Math.round(totalViews / displayCounted.length) : 0;

  async function handleToggle(id: number, newExcluded: boolean) {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, excluded: newExcluded } : p));
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, excluded: newExcluded }),
    });
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <Link href="/" className="text-xs uppercase tracking-widest font-medium mb-2 block hover:opacity-70 transition-opacity" style={{ color: PINK }}>
              ← Creator Camp
            </Link>
            <h1 className="text-3xl font-bold text-white tracking-tight">Analytics</h1>
          </div>
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={{ backgroundColor: PINK, color: "white" }}>
            ↗ Export
          </button>
        </div>

        {showExport && <ExportModal client={client} onClose={() => setShowExport(false)} />}

        {/* Client tabs */}
        <div className="flex gap-1 mb-8">
          {CLIENTS.map((c) => (
            <Link key={c} href={`/${c.toLowerCase()}`}
              className="relative px-5 py-2.5 text-sm font-medium transition-all rounded-full"
              style={c.toLowerCase() === client
                ? { backgroundColor: PINK, color: "white" }
                : { color: "rgba(255,255,255,0.35)" }
              }>
              {c}
            </Link>
          ))}
        </div>

        {/* Platform tabs + View Mode Toggle */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map((p) => {
              const isAvailable = p === "Overview" || availablePlatforms.has(p.toLowerCase());
              const isActive = activePlatform === p;
              const isComing = !isAvailable;
              return (
                <button key={p} onClick={() => !isComing && setActivePlatform(p)} disabled={isComing}
                  className="px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 border"
                  style={isActive
                    ? { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.08)", color: "white" }
                    : isComing
                    ? { borderColor: "transparent", color: "rgba(255,255,255,0.15)", cursor: "not-allowed" }
                    : { borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }
                  }>
                  {p !== "Overview" && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isAvailable ? PLATFORM_COLORS[p.toLowerCase()] : "rgba(255,255,255,0.1)" }} />
                  )}
                  {p}
                  {isComing && <span className="text-[10px] opacity-50">soon</span>}
                </button>
              );
            })}
          </div>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-white/20">Loading...</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard label="Posts" value={displayCounted.length} />
              <StatCard label="Total Views" value={fmt(totalViews)} />
              <StatCard label="Total Likes" value={fmt(totalLikes)} />
              <StatCard label="Avg Views" value={fmt(avgViews)} />
            </div>

            {/* Charts */}
            {activePlatform === "Overview" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                  <ViewsChart data={displayCounted} timeRange={chartRange1} onTimeChange={setChartRange1} />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                  <CPIStat allPosts={allCounted} monthPosts={monthCounted} clientKey={client} mode={viewMode} />
                </div>
              </div>
            )}

            {activePlatform !== "Overview" && displayCounted.length > 0 && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 mb-8">
                <ViewsChart data={displayCounted} timeRange={chartRange1} onTimeChange={setChartRange1} />
              </div>
            )}

            {/* Table */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <PostsTable posts={filtered} onToggle={handleToggle} />
            </div>

            <p className="text-white/15 text-xs mt-4 text-right">
              {allCounted.length} posts counted · Updated nightly 11pm EST
            </p>
          </>
        )}
      </div>
    </div>
  );
}
