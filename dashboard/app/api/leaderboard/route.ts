import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") === "month" ? "month" : "week";

  // Compute the start date
  const sinceQuery = await pool.query(
    range === "week"
      ? `SELECT date_trunc('week', CURRENT_DATE)::date AS since`
      : `SELECT (CURRENT_DATE - INTERVAL '30 days')::date AS since`
  );
  const since: string = sinceQuery.rows[0].since;

  const byAccountResult = await pool.query(`
    SELECT
      account,
      client,
      platform,
      COALESCE(SUM(views), 0)::int AS views,
      COUNT(*)::int AS posts,
      (
        SELECT caption
        FROM posts p2
        WHERE p2.account = p.account
          AND NOT COALESCE(p2.excluded, false)
          AND p2.posted_date >= $1
        ORDER BY p2.views DESC NULLS LAST
        LIMIT 1
      ) AS top_caption
    FROM posts p
    WHERE NOT COALESCE(excluded, false)
      AND posted_date >= $1
    GROUP BY account, client, platform
    ORDER BY views DESC
  `, [since]);

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
      AND posted_date >= $1
    ORDER BY views DESC NULLS LAST
    LIMIT 50
  `, [since]);

  return NextResponse.json({
    byAccount: byAccountResult.rows,
    byPost: byPostResult.rows,
    since,
    range,
  });
}
