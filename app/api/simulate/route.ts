export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, broadcast, ensureOccupiedRoomsHaveBaselinePower } from "../../../lib/db";

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
    const { room, isOccupied, occupancy, todayKwh } = body;

    let occupancyUpdated = false;

    // 1. Update occupancy if provided (supports full object update or single key update)
    if (occupancy && typeof occupancy === "object") {
      const occObj = occupancy as Record<string, unknown>;
      Object.keys(occObj).forEach((r) => {
        if (r in db.occupancy) {
          const nextOccupied = !!occObj[r];
          if (db.occupancy[r] !== nextOccupied) {
            db.occupancy[r] = nextOccupied;
            occupancyUpdated = true;
          }
        }
      });
      console.log("[Simulator API] Full occupancy state updated:", db.occupancy);
    } else if (room && typeof isOccupied === "boolean") {
      if (room in db.occupancy) {
        if (db.occupancy[room] !== isOccupied) {
          db.occupancy[room] = isOccupied;
          occupancyUpdated = true;
        }
        console.log(`[Simulator API] Room "${room}" occupancy updated to: ${isOccupied}`);
      }
    }

    if (occupancyUpdated) {
      ensureOccupiedRoomsHaveBaselinePower(db.occupancy);
      // Broadcast occupancy changes to all SSE clients
      broadcast("occupancy_update", db.occupancy);
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
