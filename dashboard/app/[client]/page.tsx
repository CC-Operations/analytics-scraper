"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const CLIENTS = ["Cosmos", "Poke", "Wabi", "Yahoo"];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/20 text-pink-300",
  tiktok: "bg-cyan-500/20 text-cyan-300",
  twitter: "bg-sky-500/20 text-sky-300",
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
};

function fmt(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function ClientPage() {
  const { client } = useParams<{ client: string }>();
  const clientName = client.charAt(0).toUpperCase() + client.slice(1);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/posts?client=${clientName}`)
      .then((r) => r.json())
      .then((data) => { setPosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientName]);

  const platforms = ["all", ...Array.from(new Set(posts.map((p) => p.platform)))];
  const filtered = platform === "all" ? posts : posts.filter((p) => p.platform === platform);

  const totalViews = filtered.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes = filtered.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = filtered.reduce((s, p) => s + (p.comments ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Creator Camp Analytics</h1>
        <p className="text-gray-400 text-sm">Content performance dashboard</p>
      </div>

      {/* Client tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-800 pb-0">
        {CLIENTS.map((c) => (
          <Link
            key={c}
            href={`/${c.toLowerCase()}`}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              c.toLowerCase() === client
                ? "bg-gray-800 text-white border border-b-0 border-gray-700"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Posts", value: filtered.length },
          { label: "Total Views", value: fmt(totalViews) },
          { label: "Total Likes", value: fmt(totalLikes) },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Platform filter */}
      <div className="flex gap-2 mb-5">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              platform === p
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500">No posts yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
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
              {filtered.map((post, i) => (
                <tr
                  key={post.id}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                    i === filtered.length - 1 ? "border-0" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {post.posted_date ? post.posted_date.slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{post.account}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[post.post_type] ?? "bg-gray-700 text-gray-300"}`}>
                      {post.post_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                    {post.caption || <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200 font-medium">{fmt(post.views)}</td>
                  <td className="px-4 py-3 text-right text-gray-200 font-medium">{fmt(post.likes)}</td>
                  <td className="px-4 py-3 text-right text-gray-200 font-medium">{fmt(post.comments)}</td>
                  <td className="px-4 py-3 text-center">
                    {post.post_url ? (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        ↗
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-gray-600 text-xs mt-4 text-right">
        {filtered.length} posts · Updated nightly at 11pm EST
      </p>
    </div>
  );
}
