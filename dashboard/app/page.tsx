"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const PINK = "#E82E6A";
const CLIENTS = ["Cosmos", "Poke", "Wabi", "Yahoo"];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E82E6A",
  tiktok: "#69c9d0",
  twitter: "#1d9bf0",
  manychat: "#7b61ff",
};

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

type Row = {
  client: string;
  platform: string;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  last_post: string | null;
};

type ClientSummary = {
  client: string;
  posts: number;
  views: number;
  likes: number;
  platforms: string[];
};

export default function OverviewPage() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalViews = data.reduce((s, r) => s + r.views, 0);
  const totalLikes = data.reduce((s, r) => s + r.likes, 0);
  const totalPosts = data.reduce((s, r) => s + r.posts, 0);

  const byClient: ClientSummary[] = CLIENTS.map((c) => {
    const rows = data.filter((r) => r.client.toLowerCase() === c.toLowerCase());
    return {
      client: c,
      posts: rows.reduce((s, r) => s + r.posts, 0),
      views: rows.reduce((s, r) => s + r.views, 0),
      likes: rows.reduce((s, r) => s + r.likes, 0),
      platforms: [...new Set(rows.map((r) => r.platform))],
    };
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-12">
          <span className="text-xs uppercase tracking-widest font-medium mb-2 block" style={{ color: PINK }}>
            Creator Camp
          </span>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-1">Agency HQ</h1>
          <p className="text-white/30 text-sm">All clients · All platforms</p>
        </div>

        {/* Agency-wide stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { label: "Total Posts", value: fmt(totalPosts) },
            { label: "Total Views", value: fmt(totalViews) },
            { label: "Total Likes", value: fmt(totalLikes) },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3 font-medium">{s.label}</p>
              <p className="text-4xl font-bold text-white">{loading ? "—" : s.value}</p>
            </div>
          ))}
        </div>

        {/* Client cards */}
        <div className="mb-6">
          <p className="text-white/30 text-xs uppercase tracking-widest font-medium mb-4">Clients</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byClient.map((c) => (
              <Link key={c.client} href={`/${c.client.toLowerCase()}`}
                className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/15 hover:bg-white/[0.04] transition-all">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">{c.client}</h2>
                    <div className="flex gap-1.5">
                      {c.platforms.map((p) => (
                        <span key={p} className="flex items-center gap-1 text-xs text-white/40">
                          <span className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ backgroundColor: PLATFORM_COLORS[p] ?? "#666" }} />
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </span>
                      ))}
                      {c.platforms.length === 0 && <span className="text-xs text-white/20">No data yet</span>}
                    </div>
                  </div>
                  <span className="text-white/20 group-hover:text-white/60 transition-colors text-lg">→</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Posts", value: c.posts },
                    { label: "Views", value: c.views },
                    { label: "Likes", value: c.likes },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-white/25 text-xs uppercase tracking-wider mb-1">{s.label}</p>
                      <p className="text-lg font-bold text-white">{loading ? "—" : fmt(s.value)}</p>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <p className="text-white/15 text-xs text-right mt-6">Updated nightly 11pm EST</p>
      </div>
    </div>
  );
}
