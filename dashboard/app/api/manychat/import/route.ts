import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const client = (formData.get("client") as string)?.toLowerCase();
  const file = formData.get("file") as File | null;

  if (!client || !file) {
    return NextResponse.json({ error: "client and file required" }, { status: 400 });
  }

  const validClients = ["cosmos", "poke", "wabi", "yahoo", "olive"];
  if (!validClients.includes(client)) {
    return NextResponse.json({ error: "unknown client" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV appears empty" }, { status: 400 });
  }

  // Parse headers — ManyChat uses various formats
  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/"/g, "").trim());

  // Find column indices with flexible matching
  const idIdx          = headers.findIndex(h => h === "id" || h === "subscriber id");
  const firstNameIdx   = headers.findIndex(h => h === "first name" || h === "first_name" || h === "firstname");
  const lastNameIdx    = headers.findIndex(h => h === "last name"  || h === "last_name"  || h === "lastname");
  const subscribedIdx  = headers.findIndex(h => h.includes("subscribed") || h === "opted in" || h === "created at");

  if (subscribedIdx === -1) {
    return NextResponse.json({
      error: "Could not find a subscription date column",
      detected_headers: headers,
    }, { status: 400 });
  }

  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manychat_subscribers (
      id SERIAL PRIMARY KEY,
      client TEXT NOT NULL,
      event_type TEXT NOT NULL,
      subscriber_id TEXT,
      first_name TEXT,
      last_name TEXT,
      received_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  let inserted = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols        = parseCSVLine(line);
    const subscriber_id = idIdx >= 0         ? (cols[idIdx]         ?? "").replace(/"/g, "").trim() : "";
    const first_name    = firstNameIdx >= 0   ? (cols[firstNameIdx]  ?? "").replace(/"/g, "").trim() : "";
    const last_name     = lastNameIdx >= 0    ? (cols[lastNameIdx]   ?? "").replace(/"/g, "").trim() : "";
    const rawDate       = subscribedIdx >= 0  ? (cols[subscribedIdx] ?? "").replace(/"/g, "").trim() : "";

    // Try to parse the date
    let received_at: Date | null = null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) received_at = d;
    }
    if (!received_at) {
      skipped++;
      continue;
    }

    try {
      // Skip if this subscriber_id already exists for this client
      if (subscriber_id) {
        const { rows } = await pool.query(
          `SELECT 1 FROM manychat_subscribers WHERE client = $1 AND subscriber_id = $2 AND event_type = 'subscribe' LIMIT 1`,
          [client, subscriber_id]
        );
        if (rows.length > 0) { skipped++; continue; }
      }

      await pool.query(
        `INSERT INTO manychat_subscribers (client, event_type, subscriber_id, first_name, last_name, received_at)
         VALUES ($1, 'subscribe', $2, $3, $4, $5)`,
        [client, subscriber_id, first_name, last_name, received_at]
      );
      inserted++;
    } catch (e) {
      errors.push(`Row ${i}: ${e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skipped,
    total_rows: lines.length - 1,
    detected_headers: headers,
    errors: errors.slice(0, 10),
  });
}
