import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = req.nextUrl.searchParams.get("client");
  if (!client) return NextResponse.json({ error: "client required" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT id, client, account, platform, shortcode, post_url, caption,
            post_type, views, likes, comments, posted_date, date_scraped
     FROM posts
     WHERE LOWER(client) = LOWER($1)
     ORDER BY posted_date DESC NULLS LAST
     LIMIT 200`,
    [client]
  );

  return NextResponse.json(rows);
}
