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

  // Running total
  let total = 0;
  const days = rows.map(r => {
    total += r.gained - r.lost;
    return { date: r.day, gained: r.gained, lost: r.lost, total };
  });

  // All-time totals
  const { rows: tot } = await pool.query(`
    SELECT
      SUM(CASE WHEN event_type = 'subscribe'   THEN 1 ELSE 0 END)::int AS gained,
      SUM(CASE WHEN event_type = 'unsubscribe' THEN 1 ELSE 0 END)::int AS lost
    FROM manychat_subscribers WHERE client = $1
  `, [client]);

  return NextResponse.json({
    total: (tot[0]?.gained ?? 0) - (tot[0]?.lost ?? 0),
    total_gained: tot[0]?.gained ?? 0,
    total_lost:   tot[0]?.lost   ?? 0,
    days,
  });
}
