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

// Monthly retainer per client in USD (must match [client]/page.tsx)
const MONTHLY_RETAINER: Record<string, number> = {
  cosmos: 40000,
  poke:   35000,
  wabi:   35000,
  yahoo:  0,
  olive:  15000,
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
  month_views: number;
  first_post: string | null;
  last_post: string | null;
  week_views: number;
  week_likes: number;
  week_posts: number;
  prev_week_views: number;
  prev_week_likes: number;
  prev_week_posts: number;
};

type ClientSummary = {
  client: string;
  posts: number;
  views: number;
  likes: number;
  firstPost: string | null;
  platforms: string[];
  week_views: number;
  week_likes: number;
  week_posts: number;
  prev_week_views: number;
  prev_week_likes: number;
  prev_week_posts: number;
};

type LeaderboardAccount = {
  account: string;
  client: string;
  platform: string;
  views: number;
  posts: number;
  top_caption: string | null;
};

type LeaderboardPost = {
  account: string;
  client: string;
  platform: string;
  caption: string | null;
  views: number;
  likes: number;
  comments: number;
  post_url: string | null;
  posted_date: string | null;
};

type LeaderboardData = {
  byAccount: LeaderboardAccount[];
  byPost: LeaderboardPost[];
  since: string;
  range: "week" | "month";
};

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "3px",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.01em",
      padding: "2px 7px",
      borderRadius: "999px",
      background: up ? "rgba(34,197,94,0.12)" : "rgba(248,113,113,0.12)",
      color: up ? "#4ade80" : "#f87171",
    }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function AnimatedStat({ label, value, weekVal = 0, prevWeekVal = 0, delay = 0 }: {
  label: string; value: number; weekVal?: number; prevWeekVal?: number; delay?: number
}) {
  const [started, setStarted] = useState(false);
  const [hovered, setHovered] = useState(false);
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl p-8 border transition-all duration-300 cursor-default"
      style={{
        animation: `fadeUp 0.5s ease ${delay}ms forwards, pinkPulse 3s ease-in-out ${delay}ms infinite`,
        opacity: 0,
        backgroundColor: hovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.03)",
        borderColor: hovered ? "rgba(232,46,106,0.4)" : "rgba(255,255,255,0.06)",
        boxShadow: hovered ? "0 0 40px 6px rgba(232,46,106,0.18)" : "none",
      }}>
      <p className="text-white/55 text-xs uppercase tracking-widest mb-3 font-medium">{label}</p>
      <p className="text-4xl font-bold text-white tabular-nums">{fmt(count)}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <TrendBadge current={weekVal} prev={prevWeekVal} />
        {prevWeekVal > 0 && (
          <span className="text-white/20 text-[10px]">vs last 7d</span>
        )}
      </div>
    </div>
  );
}

function ClientCard({ summary, index }: { summary: ClientSummary; index: number }) {
  const [hovered, setHovered] = useState(false);

  const retainer = MONTHLY_RETAINER[summary.client.toLowerCase()] ?? 0;
  const cpi = (() => {
    if (retainer === 0 || summary.views === 0 || !summary.firstPost) return null;
    const monthsActive = Math.max(1, (Date.now() - new Date(summary.firstPost).getTime()) / (30 * 24 * 60 * 60 * 1000));
    return (retainer * monthsActive) / summary.views;
  })();

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
                  style={{ color: PLATFORM_COLORS[p] ?? "rgba(255,255,255,0.5)" }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: PLATFORM_COLORS[p] ?? "#666" }} />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </span>
              ))}
              {summary.platforms.length === 0 && <span className="text-xs text-white/30">No data yet</span>}
            </div>
          </div>
          <span className="transition-all duration-300 text-lg"
            style={{ color: hovered ? PINK : "rgba(255,255,255,0.3)", transform: hovered ? "translateX(3px)" : "none" }}>
            →
          </span>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Posts", value: fmt(summary.posts), wk: summary.week_posts, pwk: summary.prev_week_posts },
            { label: "Views", value: fmt(summary.views), wk: summary.week_views, pwk: summary.prev_week_views },
            { label: "Likes", value: fmt(summary.likes), wk: summary.week_likes, pwk: summary.prev_week_likes },
            { label: "CPI", value: cpi != null ? `$${cpi.toFixed(3)}` : "—", wk: 0, pwk: 0 },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white/45 text-xs uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value}</p>
              {s.pwk > 0 && (
                <div className="mt-1">
                  <TrendBadge current={s.wk} prev={s.pwk} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function PlatformDot({ platform }: { platform: string }) {
  return (
    <span
      className="w-2 h-2 rounded-full inline-block flex-shrink-0"
      style={{ backgroundColor: PLATFORM_COLORS[platform] ?? "#666" }}
    />
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl p-4 border border-white/[0.04] bg-white/[0.02] animate-pulse flex gap-4 items-center">
          <div className="w-6 h-4 bg-white/10 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-white/10 rounded" />
            <div className="h-3 w-48 bg-white/[0.06] rounded" />
          </div>
          <div className="h-5 w-16 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter",
};

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? "#666";
  const label = PLATFORM_LABEL[platform] ?? platform;
  return (
    <span className="flex items-center gap-1.5 flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
}

function LeaderboardTab({ onFetch }: { onFetch: (range: "week" | "month") => Promise<LeaderboardData> }) {
  const [subTab, setSubTab] = useState<"account" | "post">("account");
  const [range, setRange] = useState<"week" | "month">("week");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    onFetch(range).then(d => { setData(d); setLoading(false); });
  }, [range]);

  const sinceLabel = data?.since
    ? new Date(data.since).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : null;

  const emptyMsg = range === "week" ? "No posts this week yet." : "No posts this month yet.";

  return (
    <div>
      {/* Sub-tab + range toggle row */}
      <div className="flex items-center gap-3 mb-6">
        {/* By Account / By Post pills */}
        {(["account", "post"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: subTab === t ? PINK : "rgba(255,255,255,0.06)",
              color: subTab === t ? "#fff" : "rgba(255,255,255,0.45)",
            }}>
            {t === "account" ? "By Account" : "By Post"}
          </button>
        ))}

        {/* Sliding week/month toggle */}
        <div className="ml-auto relative flex items-center rounded-full p-0.5"
          style={{ background: "rgba(255,255,255,0.06)", gap: 0 }}>
          <div className="absolute top-0.5 bottom-0.5 rounded-full transition-all duration-300 ease-in-out"
            style={{
              background: "rgba(255,255,255,0.12)",
              width: "calc(50% - 2px)",
              left: range === "week" ? "2px" : "calc(50%)",
            }} />
          {(["week", "month"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="relative z-10 px-4 py-1 rounded-full text-xs font-semibold transition-colors duration-200"
              style={{ color: range === r ? "#fff" : "rgba(255,255,255,0.35)" }}>
              {r === "week" ? "1W" : "1M"}
            </button>
          ))}
        </div>

        {sinceLabel && (
          <span className="text-xs text-white/25">
            {range === "week" ? `Week of ${sinceLabel}` : `Since ${sinceLabel}`}
          </span>
        )}
      </div>

      {loading && <LeaderboardSkeleton />}

      {!loading && data && subTab === "account" && (
        <div className="space-y-2">
          {data.byAccount.length === 0 && (
            <p className="text-white/30 text-sm text-center py-12">{emptyMsg}</p>
          )}
          {data.byAccount.map((row, i) => (
            <div key={`${row.account}-${row.platform}`}
              className="rounded-xl px-5 py-4 border flex items-center gap-4 transition-all duration-200"
              style={{
                backgroundColor: i === 0 ? "rgba(232,46,106,0.06)" : "rgba(255,255,255,0.02)",
                borderColor: i === 0 ? "rgba(232,46,106,0.2)" : "rgba(255,255,255,0.06)",
              }}>
              {/* Rank */}
              <div className="w-6 text-center flex-shrink-0">
                {i === 0 ? <span className="text-lg">🏆</span>
                  : <span className="text-white/30 text-sm font-mono">{i + 1}</span>}
              </div>

              {/* Account + client · platform */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm">{row.account}</span>
                  <span className="text-white/25 text-xs">·</span>
                  <span className="text-white/40 text-xs">{row.client}</span>
                  <PlatformBadge platform={row.platform} />
                </div>
                {row.top_caption && (
                  <p className="text-white/25 text-xs truncate mt-0.5">{row.top_caption}</p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-white/35 uppercase tracking-wider mb-0.5">Views</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: i === 0 ? PINK : "#fff" }}>
                    {fmt(row.views)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/35 uppercase tracking-wider mb-0.5">Posts</p>
                  <p className="text-sm font-bold text-white tabular-nums">{row.posts}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && data && subTab === "post" && (
        <div className="space-y-2">
          {data.byPost.length === 0 && (
            <p className="text-white/30 text-sm text-center py-12">{emptyMsg}</p>
          )}
          {data.byPost.map((row, i) => (
            <div key={`${row.post_url ?? i}-${i}`}
              className="rounded-xl px-5 py-4 border flex items-center gap-4 transition-all duration-200"
              style={{
                backgroundColor: i === 0 ? "rgba(232,46,106,0.06)" : "rgba(255,255,255,0.02)",
                borderColor: i === 0 ? "rgba(232,46,106,0.2)" : "rgba(255,255,255,0.06)",
              }}>
              {/* Rank */}
              <div className="w-6 text-center flex-shrink-0">
                {i === 0 ? <span className="text-lg">🏆</span>
                  : <span className="text-white/30 text-sm font-mono">{i + 1}</span>}
              </div>

              {/* Platform badge */}
              <PlatformBadge platform={row.platform} />

              {/* Caption + account */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {row.caption || <span className="text-white/30 italic">No caption</span>}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white/35 text-xs">{row.account}</span>
                  <span className="text-white/20 text-xs">·</span>
                  <span className="text-white/25 text-xs">{row.posted_date ?? ""}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-white/35 uppercase tracking-wider mb-0.5">Views</p>
                  <p
                    className="text-sm font-bold tabular-nums"
                    style={{ color: i === 0 ? PINK : "#fff" }}
                  >
                    {fmt(row.views)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/35 uppercase tracking-wider mb-0.5">Likes</p>
                  <p className="text-sm font-bold text-white tabular-nums">{fmt(row.likes)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/35 uppercase tracking-wider mb-0.5">Cmts</p>
                  <p className="text-sm font-bold text-white tabular-nums">{fmt(row.comments)}</p>
                </div>
                {row.post_url && (
                  <a
                    href={row.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/30 hover:text-white transition-colors text-sm"
                    title="Open post"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [view, setView] = useState<"overview" | "leaderboard">("overview");

  useEffect(() => {
    setTimeout(() => setHeaderVisible(true), 50);
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function fetchLeaderboard(range: "week" | "month"): Promise<LeaderboardData> {
    const r = await fetch(`/api/leaderboard?range=${range}`);
    return r.json();
  }

  const totalViews = data.reduce((s, r) => s + r.views, 0);
  const totalLikes = data.reduce((s, r) => s + r.likes, 0);
  const totalPosts = data.reduce((s, r) => s + r.posts, 0);
  const totalWeekViews = data.reduce((s, r) => s + (r.week_views ?? 0), 0);
  const totalWeekLikes = data.reduce((s, r) => s + (r.week_likes ?? 0), 0);
  const totalWeekPosts = data.reduce((s, r) => s + (r.week_posts ?? 0), 0);
  const totalPrevWeekViews = data.reduce((s, r) => s + (r.prev_week_views ?? 0), 0);
  const totalPrevWeekLikes = data.reduce((s, r) => s + (r.prev_week_likes ?? 0), 0);
  const totalPrevWeekPosts = data.reduce((s, r) => s + (r.prev_week_posts ?? 0), 0);

  const byClient: ClientSummary[] = CLIENTS.map((c) => {
    const rows = data.filter((r) => r.client.toLowerCase() === c.toLowerCase());
    return {
      client: c,
      posts: rows.reduce((s, r) => s + r.posts, 0),
      views: rows.reduce((s, r) => s + r.views, 0),
      likes: rows.reduce((s, r) => s + r.likes, 0),
      firstPost: rows.map(r => r.first_post).filter(Boolean).sort()[0] ?? null,
      platforms: [...new Set(rows.map((r) => r.platform))],
      week_views: rows.reduce((s, r) => s + (r.week_views ?? 0), 0),
      week_likes: rows.reduce((s, r) => s + (r.week_likes ?? 0), 0),
      week_posts: rows.reduce((s, r) => s + (r.week_posts ?? 0), 0),
      prev_week_views: rows.reduce((s, r) => s + (r.prev_week_views ?? 0), 0),
      prev_week_likes: rows.reduce((s, r) => s + (r.prev_week_likes ?? 0), 0),
      prev_week_posts: rows.reduce((s, r) => s + (r.prev_week_posts ?? 0), 0),
    };
  });

  const mainTabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "leaderboard" as const, label: "🏆 Leaderboard" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-8"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}>
          <span className="text-xs uppercase tracking-widest font-medium mb-3 block" style={{ color: PINK }}>
            Creator Camp
          </span>
          <h1 className="text-5xl font-bold text-white tracking-tight mb-2">Agency HQ</h1>
          <p className="text-white/40 text-sm">All clients · All platforms</p>
        </div>

        {/* Main tab bar */}
        <div className="flex gap-2 mb-8">
          {mainTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: view === t.key ? PINK : "rgba(255,255,255,0.06)",
                color: view === t.key ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab content */}
        {view === "overview" && (
          <>
            {/* Agency stats */}
            {!loading && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                <AnimatedStat label="Total Posts" value={totalPosts} weekVal={totalWeekPosts} prevWeekVal={totalPrevWeekPosts} delay={0} />
                <AnimatedStat label="Total Views" value={totalViews} weekVal={totalWeekViews} prevWeekVal={totalPrevWeekViews} delay={80} />
                <AnimatedStat label="Total Likes" value={totalLikes} weekVal={totalWeekLikes} prevWeekVal={totalPrevWeekLikes} delay={160} />
              </div>
            )}

            {loading && (
              <div className="grid grid-cols-3 gap-4 mb-8">
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
              <p className="animate-fade-up text-white/50 text-xs uppercase tracking-widest font-medium mb-4"
                style={{ animationDelay: "250ms", animationFillMode: "forwards" }}>
                Clients
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {byClient.map((c, i) => (
                  <ClientCard key={c.client} summary={c} index={i} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Leaderboard tab content */}
        {view === "leaderboard" && (
          <LeaderboardTab onFetch={fetchLeaderboard} />
        )}

        <p className="animate-fade-in text-white/15 text-xs text-right mt-8"
          style={{ animationDelay: "700ms", animationFillMode: "forwards" }}>
          Updated nightly 11pm EST
        </p>
      </div>
    </div>
  );
}
