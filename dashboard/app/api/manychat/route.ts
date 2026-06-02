import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client")?.toLowerCase();
  if (!client) return NextResponse.json({ error: "client required" }, { status: 400 });

  // Ensure table exists (no-op if already there)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manychat_subscribers (
      id SERIAL PRIMARY KEY,
      client TEXT NOT NULL,
      event_type TEXT NOT NULL,
      subscriber_id TEXT,
      first_name TEXT,
      last_name TEXT,
      received_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // Daily gains/losses
  const { rows } = await pool.query(`
    SELECT
      DATE(received_at) AS day,
      SUM(CASE WHEN event_type = 'subscribe'   THEN 1 ELSE 0 END)::int AS gained,
      SUM(CASE WHEN event_type = 'unsubscribe' THEN 1 ELSE 0 END)::int AS lost
    FROM manychat_subscribers
    WHERE client = $1
    GROUP BY day
    ORDER BY day
  `, [client]);

  // Baseline snapshot
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manychat_snapshots (
      id SERIAL PRIMARY KEY, client TEXT NOT NULL UNIQUE,
      baseline_count INTEGER NOT NULL DEFAULT 0, snapped_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  const { rows: snap } = await pool.query(
    `SELECT baseline_count FROM manychat_snapshots WHERE client = $1`, [client]
  );
  const baseline = snap[0]?.baseline_count ?? 0;

  // Running total from baseline
  let running = baseline;
  const days = rows.map(r => {
    running += r.gained - r.lost;
    return { date: r.day, gained: r.gained, lost: r.lost, total: running };
  });

  // All-time totals
  const { rows: tot } = await pool.query(`
    SELECT
      SUM(CASE WHEN event_type = 'subscribe'   THEN 1 ELSE 0 END)::int AS gained,
      SUM(CASE WHEN event_type = 'unsubscribe' THEN 1 ELSE 0 END)::int AS lost
    FROM manychat_subscribers WHERE client = $1
  `, [client]);

  const gained = tot[0]?.gained ?? 0;
  const lost   = tot[0]?.lost   ?? 0;

  // Recent contacts (most recent 100 subscribers by name)
  const { rows: contacts } = await pool.query(`
    SELECT subscriber_id, first_name, last_name, received_at
    FROM manychat_subscribers
    WHERE client = $1 AND event_type = 'subscribe'
      AND (first_name IS NOT NULL AND first_name <> '')
    ORDER BY received_at DESC
    LIMIT 100
  `, [client]);

  return NextResponse.json({
    total: baseline + gained - lost,
    baseline,
    total_gained: gained,
    total_lost:   lost,
    days,
    contacts: contacts.map(c => ({
      id: c.subscriber_id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      date: c.received_at,
    })),
  });
}
