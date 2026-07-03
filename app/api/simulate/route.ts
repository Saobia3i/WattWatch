export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, broadcast } from "../../../lib/db";

export async function GET() {
  return NextResponse.json({
    devices: db.devices,
    occupancy: db.occupancy,
    todayKwh: db.todayKwh,
    alerts: db.alerts,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room, isOccupied, todayKwh } = body;

    // 1. Update occupancy if provided
    if (room && typeof isOccupied === "boolean") {
      if (room in db.occupancy) {
        db.occupancy[room] = isOccupied;
        console.log(`[Simulator API] Room "${room}" occupancy updated to: ${isOccupied}`);
        // Broadcast occupancy changes to all SSE clients
        broadcast("occupancy_update", db.occupancy);
      }
    }

    // 2. Update today's energy if provided
    if (typeof todayKwh === "number") {
      db.todayKwh = todayKwh;
      
      // Broadcast usage update to clients
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
    }

    return NextResponse.json({
      devices: db.devices,
      occupancy: db.occupancy,
      todayKwh: db.todayKwh,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
