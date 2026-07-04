export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";
import { broadcast } from "../../../lib/db";
import { Alert } from "../../../lib/api-client";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM alerts WHERE is_active = 1 ORDER BY triggered_at DESC");
    
    const alerts: Alert[] = rows.map((row) => ({
      id: row.id,
      severity: row.severity as "warning" | "critical",
      message: row.message,
      room: row.room_id,
      timestamp: row.triggered_at,
    }));
    
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Alerts GET Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { severity, message, room } = body;

    if (!severity || !message) {
      return NextResponse.json({ error: "Missing severity or message" }, { status: 400 });
    }

    const db = await getDb();
    const id = `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    // Check if the alert already exists in active alerts to prevent spam
    const existing = await db.get("SELECT id FROM alerts WHERE message = ? AND is_active = 1", [message]);
    if (existing) {
      return NextResponse.json({ message: "Duplicate active alert. Ignored." });
    }

    await db.run(
      "INSERT INTO alerts (id, room_id, severity, message, is_active, triggered_at) VALUES (?, ?, ?, ?, 1, ?)",
      [id, room || "office", severity, message, now]
    );

    const newAlert: Alert = {
      id,
      severity,
      message,
      room,
      timestamp: now,
    };

    // Broadcast update to all SSE clients
    broadcast("alert", newAlert);

    return NextResponse.json(newAlert);
  } catch (error) {
    console.error("Alerts POST Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing alert ID" }, { status: 400 });
    }

    const db = await getDb();
    await db.run("UPDATE alerts SET is_active = 0 WHERE id = ?", [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Alerts DELETE Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
