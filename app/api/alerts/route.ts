export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, broadcast } from "../../../lib/db";
import { Alert } from "../../../lib/api-client";

export async function GET() {
  return NextResponse.json(db.alerts);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { severity, message, room } = body;

    if (!severity || !message) {
      return NextResponse.json({ error: "Missing severity or message" }, { status: 400 });
    }

    const newAlert: Alert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      severity,
      message,
      room,
      timestamp: new Date().toISOString(),
    };

    // Add to DB
    db.alerts.unshift(newAlert);

    // Keep active alerts size bounded (e.g. max 50)
    if (db.alerts.length > 50) {
      db.alerts.pop();
    }

    // Broadcast new alert to all SSE clients
    broadcast("alert", newAlert);

    return NextResponse.json(newAlert);
  } catch (error: unknown) {
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

    // Filter out the alert
    db.alerts = db.alerts.filter((a) => a.id !== id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
