import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST() {
  const scraperUrl = process.env.SCRAPER_URL?.replace(/\/$/, ""); // strip trailing slash
  const secret     = process.env.REFRESH_SECRET ?? "";

  if (!scraperUrl) {
    return NextResponse.json({ error: "SCRAPER_URL not configured" }, { status: 500 });
  }

  const url = `${scraperUrl}/refresh`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Refresh proxy error:", msg, "url:", url);
    return NextResponse.json({ error: "Could not reach scraper", detail: msg }, { status: 502 });
  }
}
