export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, broadcast } from "../../../lib/db";

export async function GET() {
  return NextResponse.json(db.devices);
}

export async function POST(request: NextRequest) {
  try {
    const { id, status } = await request.json();
    const device = db.devices.find((d) => d.id === id);

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    if (status !== "on" && status !== "off") {
      return NextResponse.json({ error: "Device status must be 'on' or 'off'" }, { status: 400 });
    }

    // Telemetry update from simulator/database feed.
    device.status = status;
    device.lastChanged = new Date().toISOString();

    // Broadcast update to all SSE clients
    broadcast("device_update", device);

    // Derived updates: calculate total active demand and broadcast
    let totalWatts = 0;
    const perRoomWatts = { drawing: 0, work1: 0, work2: 0 };
    
    db.devices.forEach((d) => {
      if (d.status === "on") {
        totalWatts += d.wattage;
        perRoomWatts[d.room] += d.wattage;
      }
    });

    broadcast("usage_update", {
      totalWattsNow: totalWatts,
      todayKwh: db.todayKwh,
      perRoom: perRoomWatts,
    });

    return NextResponse.json(device);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
