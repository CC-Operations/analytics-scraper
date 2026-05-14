import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const client = searchParams.get("client");
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");

  if (!client || !from || !to) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const { rows } = await pool.query(`
    SELECT
      id, client, account, platform, shortcode, post_url,
      caption, post_type, views, likes, comments, posted_date, excluded
    FROM posts
    WHERE LOWER(client) = LOWER($1)
      AND posted_date BETWEEN $2 AND $3
      AND NOT COALESCE(excluded, false)
    ORDER BY posted_date DESC
  `, [client, from, to]);

  return NextResponse.json(rows);
}
