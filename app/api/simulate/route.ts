export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, broadcast, ensureOccupiedRoomsHaveBaselinePower, toOccupantCount } from "../../../lib/db";

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
    const { room, isOccupied, occupantCount, occupancy, todayKwh } = body;

    let occupancyUpdated = false;

    // 1. Update occupancy if provided (supports full object update or single key update)
    if (occupancy && typeof occupancy === "object") {
      const occObj = occupancy as Record<string, unknown>;
      Object.keys(occObj).forEach((r) => {
        if (r in db.occupancy) {
          const nextCount = toOccupantCount(occObj[r]);
          if (db.occupancy[r] !== nextCount) {
            db.occupancy[r] = nextCount;
            occupancyUpdated = true;
          }
        }
      });
      console.log("[Simulator API] Full occupancy state updated:", db.occupancy);
    } else if (room && (typeof isOccupied === "boolean" || typeof occupantCount === "number")) {
      if (room in db.occupancy) {
        const nextCount = typeof occupantCount === "number" ? toOccupantCount(occupantCount) : toOccupantCount(isOccupied);
        if (db.occupancy[room] !== nextCount) {
          db.occupancy[room] = nextCount;
          occupancyUpdated = true;
        }
        console.log(`[Simulator API] Room "${room}" occupancy count updated to: ${nextCount}`);
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
