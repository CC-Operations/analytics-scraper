import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  if (!client) return NextResponse.json({ error: "client required" }, { status: 400 });

  // Ensure excluded column exists
  await pool.query(`
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT FALSE
  `).catch(() => {});

  const { rows } = await pool.query(
    `SELECT id, client, account, platform, shortcode, post_url, caption,
            post_type, views, likes, comments, posted_date, date_scraped,
            COALESCE(excluded, FALSE) as excluded
     FROM posts
     WHERE LOWER(client) = LOWER($1)
     ORDER BY posted_date DESC NULLS LAST
     LIMIT 200`,
    [client]
  );

  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const { id, excluded } = await req.json();
  if (id == null) return NextResponse.json({ error: "id required" }, { status: 400 });

  await pool.query(
    `UPDATE posts SET excluded = $1 WHERE id = $2`,
    [excluded, id]
  );

  return NextResponse.json({ ok: true });
}
