export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { addAlert, db, dedupeAlerts } from "../../../lib/db";
import { Alert } from "../../../lib/api-client";

export async function GET() {
  db.alerts = dedupeAlerts(db.alerts);
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

    addAlert(newAlert);

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
