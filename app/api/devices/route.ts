// app/api/devices/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";
import { broadcast } from "../../../lib/db"; // Keeps the real-time websocket working

// GET: Fetch all devices and initialize DB if missing
export async function GET() {
  try {
    // Connect to SQLite (handles initialization automatically)
    const db = await getDb();

    // 3. Read the live data
    const rows = await db.all("SELECT * FROM devices");

    // 4. Format it for the React UI
    const devices = rows.map((row) => ({
      id: row.id,
      type: row.type,
      room: row.room_id,
      label: row.name,
      status: row.is_on === 1 ? "on" : "off",
      wattage: row.rated_power_watts,
      lastChanged: row.last_changed,
    }));

    return NextResponse.json(devices);
  } catch (error) {
    console.error("Database GET Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST: Set or toggle a device on/off
export async function POST(request: NextRequest) {
  try {
    // Parse the JSON exactly once to get the ID/status from the frontend
    const { id, status } = await request.json();
    const db = await getDb();

    // 1. Find the device in the SQLite database
    const device = await db.get("SELECT * FROM devices WHERE id = ?", [id]);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // 2. Respect explicit ON/OFF commands; fall back to toggle for older callers
    const newIsOn =
      status === "on" ? 1 :
      status === "off" ? 0 :
      device.is_on === 1 ? 0 : 1;
    const now = new Date().toISOString();

    // 3. Save the new status to SQLite
    await db.run(
      "UPDATE devices SET is_on = ?, last_changed = ? WHERE id = ?",
      [newIsOn, now, id]
    );

    // 4. Fetch the updated row to broadcast
    const updatedRow = await db.get("SELECT * FROM devices WHERE id = ?", [id]);
    const updatedDevice = {
      id: updatedRow.id,
      type: updatedRow.type,
      room: updatedRow.room_id,
      label: updatedRow.name,
      status: updatedRow.is_on === 1 ? "on" : "off",
      wattage: updatedRow.rated_power_watts,
      lastChanged: updatedRow.last_changed,
    };

    // 5. Broadcast the update to the UI
    broadcast("device_update", updatedDevice);

    return NextResponse.json(updatedDevice);
  } catch (error) {
    console.error("Database POST Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
