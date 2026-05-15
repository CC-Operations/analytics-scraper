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
      -- This week (last 7 days)
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) AND posted_date >= CURRENT_DATE - INTERVAL '7 days' THEN views ELSE 0 END), 0)::int AS week_views,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) AND posted_date >= CURRENT_DATE - INTERVAL '7 days' THEN likes ELSE 0 END), 0)::int AS week_likes,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) AND posted_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END), 0)::int AS week_posts,
      -- Prior week (7–14 days ago)
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) AND posted_date >= CURRENT_DATE - INTERVAL '14 days' AND posted_date < CURRENT_DATE - INTERVAL '7 days' THEN views ELSE 0 END), 0)::int AS prev_week_views,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) AND posted_date >= CURRENT_DATE - INTERVAL '14 days' AND posted_date < CURRENT_DATE - INTERVAL '7 days' THEN likes ELSE 0 END), 0)::int AS prev_week_likes,
      COALESCE(SUM(CASE WHEN NOT COALESCE(excluded, false) AND posted_date >= CURRENT_DATE - INTERVAL '14 days' AND posted_date < CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END), 0)::int AS prev_week_posts,
      MIN(posted_date) AS first_post,
      MAX(posted_date) AS last_post
    FROM posts
    GROUP BY client, platform
    ORDER BY client, platform
  `);

  return NextResponse.json(rows);
}
