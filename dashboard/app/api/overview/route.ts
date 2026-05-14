import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query(`
    SELECT
      client,
      platform,
      COUNT(*)::int AS posts,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) THEN views ELSE 0 END), 0)::int AS views,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) THEN likes ELSE 0 END), 0)::int AS likes,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) THEN comments ELSE 0 END), 0)::int AS comments,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) AND date_trunc('month', posted_date) = date_trunc('month', CURRENT_DATE) THEN views ELSE 0 END), 0)::int AS month_views,
      MAX(posted_date) AS last_post
    FROM posts
    GROUP BY client, platform
    ORDER BY client, platform
  `);

  return NextResponse.json(rows);
}
