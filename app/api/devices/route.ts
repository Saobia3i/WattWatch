// app/api/devices/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";
import { initializeDatabase } from "../../../lib/init-db";
import { broadcast } from "../../../lib/db"; // Keeps the real-time websocket working

// GET: Fetch all devices and initialize DB if missing
export async function GET() {
  try {
    // 1. Ensure the database and tables exist
    await initializeDatabase();

    // 2. Connect to SQLite
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
  } catch (error: any) {
    console.error("Database GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Toggle a device on/off
export async function POST(request: NextRequest) {
  try {
    // Parse the JSON exactly once to get the ID from the frontend
    const { id } = await request.json();
    const db = await getDb();

    // 1. Find the device in the SQLite database
    const device = await db.get("SELECT * FROM devices WHERE id = ?", [id]);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // 2. Toggle the status (0 to 1, or 1 to 0)
    const newIsOn = device.is_on === 1 ? 0 : 1;
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
  } catch (error: any) {
    console.error("Database POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
