export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";
import { broadcast } from "../../../lib/db";

// GET: Retrieve all active alerts
export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM alerts WHERE is_active = 1 ORDER BY triggered_at DESC");
    
    const alerts = rows.map((r) => ({
      id: r.id,
      severity: r.severity,
      message: r.message,
      room: r.room_id,
      timestamp: r.triggered_at,
    }));
    
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Alerts GET Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Add a new alert manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { severity, message, room } = body;

    if (!severity || !message) {
      return NextResponse.json({ error: "Missing severity or message" }, { status: 400 });
    }

    const db = await getDb();
    const id = `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    await db.run(
      "INSERT INTO alerts (id, room_id, severity, message, is_active, triggered_at) VALUES (?, ?, ?, ?, 1, ?)",
      [id, room || null, severity, message, nowIso]
    );

    const newAlert = {
      id,
      severity,
      message,
      room,
      timestamp: nowIso,
    };

    // Broadcast live update
    broadcast("alert", newAlert);

    return NextResponse.json(newAlert);
  } catch (error) {
    console.error("Alerts POST Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE: Clear/delete an alert
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing alert ID" }, { status: 400 });
    }

    const db = await getDb();
    
    // Hard delete or soft delete
    await db.run("DELETE FROM alerts WHERE id = ?", [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Alerts DELETE Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
