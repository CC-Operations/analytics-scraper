import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  // Compute the Monday of the current week (week starts Monday)
  const weekStartQuery = await pool.query(`
    SELECT date_trunc('week', CURRENT_DATE)::date AS week_start
  `);
  const weekStart: string = weekStartQuery.rows[0].week_start;

  // By account: total views, posts, and top caption for this week
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
  `, [weekStart]);

  // By post: individual posts sorted by views
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
  `, [weekStart]);

  return NextResponse.json({
    byAccount: byAccountResult.rows,
    byPost: byPostResult.rows,
    weekStart,
  });
}
