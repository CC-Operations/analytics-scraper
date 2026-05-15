import { NextResponse } from "next/server";

export async function POST() {
  const scraperUrl = process.env.SCRAPER_URL;
  const secret     = process.env.REFRESH_SECRET ?? "";

  if (!scraperUrl) {
    return NextResponse.json({ error: "SCRAPER_URL not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${scraperUrl}/refresh`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: "Could not reach scraper" }, { status: 502 });
  }
}
