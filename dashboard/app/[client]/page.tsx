"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Area, AreaChart, BarChart, Bar,
} from "recharts";

const PINK = "#E82E6A";
const CLIENTS = ["Cosmos", "Poke", "Wabi", "Yahoo"];
const PLATFORMS = ["Overview", "Instagram", "TikTok", "Twitter", "ManyChat"];
const TIME_RANGES = ["1D", "5D", "1M", "6M", "YTD", "All"];

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
  else if (range === "5D") cutoff.setDate(now.getDate() - 5);
  else if (range === "1M") cutoff.setMonth(now.getMonth() - 1);
  else if (range === "6M") cutoff.setMonth(now.getMonth() - 6);
  else if (range === "YTD") { cutoff.setMonth(0); cutoff.setDate(1); }
  return posts.filter((p) => p.posted_date && new Date(cleanDate(p.posted_date)) >= cutoff);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-white/10 transition-colors">
      <p className="text-white/40 text-xs uppercase tracking-widest mb-2 font-medium">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

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

function ViewsChart({ data, timeRange, onTimeChange }: { data: Post[]; timeRange: string; onTimeChange: (v: string) => void }) {
  const filtered = filterByRange(data, timeRange);
  const chartData = filtered
    .filter((p) => p.posted_date)
    .sort((a, b) => cleanDate(a.posted_date) > cleanDate(b.posted_date) ? 1 : -1)
    .map((p) => ({
      date: cleanDate(p.posted_date).slice(5),
      Views: p.views ?? 0,
      Likes: p.likes ?? 0,
    }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">Views & Likes Over Time</p>
        <TimeFilter value={timeRange} onChange={onTimeChange} />
      </div>
      {chartData.length === 0
        ? <div className="flex items-center justify-center h-40 text-white/20 text-sm">No data for this period</div>
        : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PINK} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PINK} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="likesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}
                formatter={(v: number) => fmt(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }} />
              <Area type="monotone" dataKey="Views" stroke={PINK} strokeWidth={2} fill="url(#viewsGrad)" dot={false} />
              <Area type="monotone" dataKey="Likes" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} fill="url(#likesGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
    </div>
  );
}

function PlatformBreakdown({ data, timeRange, onTimeChange }: { data: Post[]; timeRange: string; onTimeChange: (v: string) => void }) {
  const filtered = filterByRange(data, timeRange);
  const byPlatform = ["instagram", "tiktok", "twitter"].map((p) => {
    const posts = filtered.filter((d) => d.platform === p);
    return {
      name: p.charAt(0).toUpperCase() + p.slice(1),
      Views: posts.reduce((s, d) => s + (d.views ?? 0), 0),
      Posts: posts.length,
    };
  }).filter((p) => p.Posts > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-white/40 text-xs uppercase tracking-widest font-medium">Performance by Platform</p>
        <TimeFilter value={timeRange} onChange={onTimeChange} />
      </div>
      {byPlatform.length === 0
        ? <div className="flex items-center justify-center h-40 text-white/20 text-sm">No data for this period</div>
        : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byPlatform} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}
                formatter={(v: number) => fmt(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }} />
              <Bar dataKey="Views" fill={PINK} radius={[6, 6, 0, 0]} />
              <Bar dataKey="Posts" fill="rgba(255,255,255,0.12)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
    </div>
  );
}

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

function PostsTable({ posts, onToggle }: { posts: Post[]; onToggle: (id: number, excluded: boolean) => void }) {
  if (posts.length === 0)
    return <div className="flex items-center justify-center h-48 text-white/20">No posts yet</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.06] text-white/30 text-xs uppercase tracking-widest">
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
            <td className="px-4 py-3 text-white/40 whitespace-nowrap font-mono text-xs">{cleanDate(post.posted_date) || "—"}</td>
            <td className="px-4 py-3 text-white/60 whitespace-nowrap">{post.account}</td>
            <td className="px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PLATFORM_COLORS[post.platform] ?? "#666" }} />
                {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
              </span>
            </td>
            <td className="px-4 py-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[post.post_type] ?? "bg-white/5 text-white/40 border border-white/10"}`}>
                {post.post_type || "—"}
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

export default function ClientPage() {
  const { client } = useParams<{ client: string }>();
  const clientName = client.charAt(0).toUpperCase() + client.slice(1);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState("Overview");
  const [chartRange1, setChartRange1] = useState("All");
  const [chartRange2, setChartRange2] = useState("All");

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
  const counted = filtered.filter((p) => !p.excluded);
  const totalViews = counted.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes = counted.reduce((s, p) => s + (p.likes ?? 0), 0);
  const avgViews = counted.length > 0 ? Math.round(totalViews / counted.length) : 0;

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
        </div>

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

        {/* Platform tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
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

        {loading ? (
          <div className="flex items-center justify-center h-64 text-white/20">Loading...</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard label="Posts" value={counted.length} />
              <StatCard label="Total Views" value={fmt(totalViews)} />
              <StatCard label="Total Likes" value={fmt(totalLikes)} />
              <StatCard label="Avg Views" value={fmt(avgViews)} />
            </div>

            {/* Charts */}
            {activePlatform === "Overview" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                  <ViewsChart data={counted} timeRange={chartRange1} onTimeChange={setChartRange1} />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                  <PlatformBreakdown data={posts.filter(p => !p.excluded)} timeRange={chartRange2} onTimeChange={setChartRange2} />
                </div>
              </div>
            )}

            {activePlatform !== "Overview" && counted.length > 0 && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 mb-8">
                <ViewsChart data={counted} timeRange={chartRange1} onTimeChange={setChartRange1} />
              </div>
            )}

            {/* Table */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <PostsTable posts={filtered} onToggle={handleToggle} />
            </div>

            <p className="text-white/15 text-xs mt-4 text-right">
              {counted.length} posts counted · Updated nightly 11pm EST
            </p>
          </>
        )}
      </div>
    </div>
  );
}
