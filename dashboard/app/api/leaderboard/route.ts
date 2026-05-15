import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawRange = searchParams.get("range");
  const range: "week" | "month" | "all" =
    rawRange === "month" ? "month" : rawRange === "all" ? "all" : "week";

  // Compute the start date (null = no filter for all-time)
  let since: string | null = null;
  if (range !== "all") {
    const sinceQuery = await pool.query(
      range === "week"
        ? `SELECT date_trunc('week', CURRENT_DATE)::date AS since`
        : `SELECT (CURRENT_DATE - INTERVAL '30 days')::date AS since`
    );
    since = sinceQuery.rows[0].since;
  }

  const dateFilter = since ? `AND posted_date >= $1` : "";
  const params = since ? [since] : [];

  const byAccountResult = await pool.query(`
    SELECT
      account,
      client,
      platform,
      COALESCE(SUM(views), 0)::int AS views,
      COALESCE(SUM(likes), 0)::int AS likes,
      COUNT(*)::int AS posts,
      (
        SELECT caption
        FROM posts p2
        WHERE p2.account = p.account
          AND NOT COALESCE(p2.excluded, false)
          ${since ? "AND p2.posted_date >= $1" : ""}
        ORDER BY p2.views DESC NULLS LAST
        LIMIT 1
      ) AS top_caption
    FROM posts p
    WHERE NOT COALESCE(excluded, false)
      ${dateFilter}
    GROUP BY account, client, platform
    ORDER BY views DESC
  `, params);

  const byPostResult = await pool.query(`
    SELECT
      account,
      client,
      platform,
      caption,
      COALESCE(views, 0)::int AS views,
      COALESCE(likes, 0)::int AS likes,
      COALESCE(comments, 0)::int AS comments,
      post_url,
      posted_date::text AS posted_date
    FROM posts
    WHERE NOT COALESCE(excluded, false)
      ${dateFilter}
    ORDER BY views DESC NULLS LAST
    LIMIT 50
  `, params);

  return NextResponse.json({
    byAccount: byAccountResult.rows,
    byPost: byPostResult.rows,
    since,
    range,
  });
}
