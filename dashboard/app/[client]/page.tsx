"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const CLIENTS = ["Cosmos", "Poke", "Wabi", "Yahoo"];
const PLATFORMS = ["Overview", "Instagram", "TikTok", "Twitter", "ManyChat"];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#e1306c",
  tiktok: "#69c9d0",
  twitter: "#1d9bf0",
  manychat: "#7b61ff",
};

const TYPE_COLORS: Record<string, string> = {
  Video: "bg-purple-500/20 text-purple-300",
  Image: "bg-green-500/20 text-green-300",
  Sidecar: "bg-orange-500/20 text-orange-300",
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ViewsChart({ data }: { data: Post[] }) {
  const chartData = data
    .filter((p) => p.posted_date && (p.views || p.likes))
    .sort((a, b) => (a.posted_date! > b.posted_date! ? 1 : -1))
    .slice(-20)
    .map((p) => ({
      date: p.posted_date!.slice(5),
      Views: p.views ?? 0,
      Likes: p.likes ?? 0,
    }));

  if (chartData.length === 0)
    return <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(v: number) => fmt(v)}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
        <Line type="monotone" dataKey="Views" stroke="#818cf8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Likes" stroke="#f472b6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PlatformBreakdown({ data }: { data: Post[] }) {
  const byPlatform = ["instagram", "tiktok", "twitter"].map((p) => {
    const posts = data.filter((d) => d.platform === p);
    return {
      name: p.charAt(0).toUpperCase() + p.slice(1),
      Views: posts.reduce((s, d) => s + (d.views ?? 0), 0),
      Posts: posts.length,
    };
  }).filter((p) => p.Posts > 0);

  if (byPlatform.length === 0)
    return <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={byPlatform} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(v: number) => fmt(v)}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
        <Bar dataKey="Views" fill="#818cf8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Posts" fill="#34d399" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      title={checked ? "Excluded from analytics — click to include" : "Included in analytics — click to exclude"}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? "bg-indigo-500" : "bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function PostsTable({ posts, onToggle }: { posts: Post[]; onToggle: (id: number, excluded: boolean) => void }) {
  if (posts.length === 0)
    return <div className="flex items-center justify-center h-48 text-gray-500">No posts yet for this platform</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
          <th className="text-center px-4 py-3 font-medium" title="Toggle to include/exclude from analytics">Count</th>
          <th className="text-left px-4 py-3 font-medium">Date</th>
          <th className="text-left px-4 py-3 font-medium">Account</th>
          <th className="text-left px-4 py-3 font-medium">Type</th>
          <th className="text-left px-4 py-3 font-medium">Caption</th>
          <th className="text-right px-4 py-3 font-medium">Views</th>
          <th className="text-right px-4 py-3 font-medium">Likes</th>
          <th className="text-right px-4 py-3 font-medium">Comments</th>
          <th className="text-center px-4 py-3 font-medium">Link</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post, i) => (
          <tr
            key={post.id}
            className={`border-b border-gray-800/50 transition-colors ${
              post.excluded ? "opacity-40" : "hover:bg-gray-800/30"
            } ${i === posts.length - 1 ? "border-0" : ""}`}
          >
            <td className="px-4 py-3 text-center">
              <Toggle checked={!post.excluded} onChange={() => onToggle(post.id, !post.excluded)} />
            </td>
            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{post.posted_date ? post.posted_date.slice(0, 10) : "—"}</td>
            <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{post.account}</td>
            <td className="px-4 py-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[post.post_type] ?? "bg-gray-700 text-gray-300"}`}>
                {post.post_type || "—"}
              </span>
            </td>
            <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{post.caption || <span className="text-gray-600">—</span>}</td>
            <td className="px-4 py-3 text-right text-gray-200 font-medium">{fmt(post.views)}</td>
            <td className="px-4 py-3 text-right text-gray-200 font-medium">{fmt(post.likes)}</td>
            <td className="px-4 py-3 text-right text-gray-200 font-medium">{fmt(post.comments)}</td>
            <td className="px-4 py-3 text-center">
              {post.post_url ? (
                <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">↗</a>
              ) : "—"}
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

  useEffect(() => {
    setLoading(true);
    setActivePlatform("Overview");
    fetch(`/api/posts?client=${clientName}`)
      .then((r) => r.json())
      .then((data) => { setPosts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientName]);

  const availablePlatforms = new Set(posts.map((p) => p.platform));

  const filtered = activePlatform === "Overview"
    ? posts
    : posts.filter((p) => p.platform === activePlatform.toLowerCase());

  // Only count non-excluded posts in stats
  const counted = filtered.filter((p) => !p.excluded);
  const totalViews = counted.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes = counted.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = counted.reduce((s, p) => s + (p.comments ?? 0), 0);
  const avgViews = counted.length > 0 ? Math.round(totalViews / counted.length) : 0;

  async function handleToggle(id: number, newExcluded: boolean) {
    // Optimistic update
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, excluded: newExcluded } : p));
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, excluded: newExcluded }),
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Creator Camp Analytics</h1>
        <p className="text-gray-500 text-sm">Content performance dashboard</p>
      </div>

      {/* Client tabs */}
      <div className="flex gap-1 mb-8 border-b border-gray-800">
        {CLIENTS.map((c) => (
          <Link
            key={c}
            href={`/${c.toLowerCase()}`}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              c.toLowerCase() === client
                ? "bg-gray-900 text-white border border-b-0 border-gray-700"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {PLATFORMS.map((p) => {
          const isAvailable = p === "Overview" || availablePlatforms.has(p.toLowerCase());
          const isActive = activePlatform === p;
          const isComing = !isAvailable;
          return (
            <button
              key={p}
              onClick={() => !isComing && setActivePlatform(p)}
              disabled={isComing}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                isActive ? "bg-white text-gray-900"
                : isComing ? "bg-gray-800/40 text-gray-600 cursor-not-allowed"
                : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              {p !== "Overview" && (
                <span
                  className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: isAvailable ? PLATFORM_COLORS[p.toLowerCase()] : "#374151" }}
                />
              )}
              {p}
              {isComing && <span className="text-[10px] text-gray-600 ml-0.5">soon</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Posts" value={filtered.length} />
            <StatCard label="Total Views" value={fmt(totalViews)} />
            <StatCard label="Total Likes" value={fmt(totalLikes)} />
            <StatCard label="Avg Views" value={fmt(avgViews)} />
          </div>

          {/* Overview charts */}
          {activePlatform === "Overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm font-medium mb-4">Views & Likes Over Time</p>
                <ViewsChart data={counted} />
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-sm font-medium mb-4">Performance by Platform</p>
                <PlatformBreakdown data={posts.filter(p => !p.excluded)} />
              </div>
            </div>
          )}

          {/* Platform chart */}
          {activePlatform !== "Overview" && counted.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
              <p className="text-gray-400 text-sm font-medium mb-4">{activePlatform} — Views Over Time</p>
              <ViewsChart data={counted} />
            </div>
          )}

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <PostsTable posts={filtered} onToggle={handleToggle} />
          </div>

          <p className="text-gray-600 text-xs mt-4 text-right">
            {filtered.length} posts · Updated nightly 11pm EST
          </p>
        </>
      )}
    </div>
  );
}
