"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const PINK = "#E82E6A";
const CLIENTS = ["Cosmos", "Poke", "Wabi", "Yahoo", "Olive"];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E82E6A",
  tiktok: "#69c9d0",
  twitter: "#1d9bf0",
  manychat: "#7b61ff",
};

function useCountUp(target: number, duration = 1200, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started || target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, started]);
  return value;
}

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

function AnimatedStat({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const count = useCountUp(value, 1400, started);

  return (
    <div ref={ref}
      className="animate-fade-up animate-pink-pulse bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 hover:border-white/10 transition-colors"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}>
      <p className="text-white/30 text-xs uppercase tracking-widest mb-3 font-medium">{label}</p>
      <p className="text-4xl font-bold text-white tabular-nums">{fmt(count)}</p>
    </div>
  );
}

function ClientCard({ summary, index }: { summary: ClientSummary; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={`/${summary.client.toLowerCase()}`}
      className="animate-fade-up block"
      style={{ animationDelay: `${300 + index * 80}ms`, animationFillMode: "forwards" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div
        className="rounded-2xl p-6 border transition-all duration-300"
        style={{
          backgroundColor: hovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
          borderColor: hovered ? "rgba(232,46,106,0.3)" : "rgba(255,255,255,0.06)",
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          boxShadow: hovered ? "0 8px 32px rgba(232,46,106,0.08)" : "none",
        }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">{summary.client}</h2>
            <div className="flex gap-2 flex-wrap">
              {summary.platforms.map((p) => (
                <span key={p} className="flex items-center gap-1 text-xs"
                  style={{ color: PLATFORM_COLORS[p] ?? "rgba(255,255,255,0.4)" }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: PLATFORM_COLORS[p] ?? "#666" }} />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </span>
              ))}
              {summary.platforms.length === 0 && <span className="text-xs text-white/20">No data yet</span>}
            </div>
          </div>
          <span className="text-white/20 transition-all duration-300 text-lg"
            style={{ color: hovered ? PINK : "rgba(255,255,255,0.2)", transform: hovered ? "translateX(3px)" : "none" }}>
            →
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Posts", value: summary.posts },
            { label: "Views", value: summary.views },
            { label: "Likes", value: summary.likes },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white/25 text-xs uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-lg font-bold text-white">{fmt(s.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setHeaderVisible(true), 50);
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
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-14"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}>
          <span className="text-xs uppercase tracking-widest font-medium mb-3 block" style={{ color: PINK }}>
            Creator Camp
          </span>
          <h1 className="text-5xl font-bold text-white tracking-tight mb-2">Agency HQ</h1>
          <p className="text-white/30 text-sm">All clients · All platforms</p>
        </div>

        {/* Agency stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4 mb-14">
            <AnimatedStat label="Total Posts" value={totalPosts} delay={0} />
            <AnimatedStat label="Total Views" value={totalViews} delay={80} />
            <AnimatedStat label="Total Likes" value={totalLikes} delay={160} />
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-3 gap-4 mb-14">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-8 animate-pulse">
                <div className="h-3 w-20 bg-white/10 rounded mb-4" />
                <div className="h-9 w-28 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Clients */}
        <div>
          <p className="animate-fade-up text-white/25 text-xs uppercase tracking-widest font-medium mb-5"
            style={{ animationDelay: "250ms", animationFillMode: "forwards" }}>
            Clients
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byClient.map((c, i) => (
              <ClientCard key={c.client} summary={c} index={i} />
            ))}
          </div>
        </div>

        <p className="animate-fade-in text-white/10 text-xs text-right mt-8"
          style={{ animationDelay: "700ms", animationFillMode: "forwards" }}>
          Updated nightly 11pm EST
        </p>
      </div>
    </div>
  );
}
