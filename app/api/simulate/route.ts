export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";
import { broadcast, toOccupantCount } from "../../../lib/db";
import { Database } from "sqlite";

interface DeviceRow {
  id: string;
  room_id: string;
  name: string;
  type: string;
  is_on: number;
  rated_power_watts: number;
  last_changed: string;
}

export async function GET() {
  try {
    const db = await getDb();
    
    // 1. Fetch devices
    const deviceRows = await db.all<DeviceRow[]>("SELECT * FROM devices");
    const devices = deviceRows.map((d) => ({
      id: d.id,
      type: d.type,
      room: d.room_id,
      label: d.name,
      status: d.is_on === 1 ? "on" : "off",
      wattage: d.rated_power_watts,
      lastChanged: d.last_changed,
    }));

    // 2. Fetch occupancy
    const sensors = await db.all("SELECT * FROM room_sensors");
    const occupancy: Record<string, number> = { drawing: 0, work1: 0, work2: 0 };
    sensors.forEach((s) => {
      occupancy[s.room_id] = s.is_occupied === 1 ? s.enter_count - s.exit_count : 0;
    });

    // 3. Fetch today's kWh
    const todayKwhRow = await db.get("SELECT value FROM system_state WHERE key = 'today_kwh'");
    const todayKwh = todayKwhRow ? parseFloat(todayKwhRow.value) : 4.85;

    // 4. Fetch alerts
    const alertRows = await db.all("SELECT * FROM alerts WHERE is_active = 1");
    const alerts = alertRows.map((a) => ({
      id: a.id,
      severity: a.severity,
      message: a.message,
      room: a.room_id,
      timestamp: a.triggered_at,
    }));

    return NextResponse.json({
      devices,
      occupancy,
      todayKwh,
      alerts,
    });
  } catch (error) {
    console.error("Simulate GET Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room, isOccupied, occupantCount, occupancy, todayKwh } = body;

    const db = await getDb();
    const nowIso = new Date().toISOString();
    let occupancyUpdated = false;

    // 1. Fetch current database occupancy
    const sensors = await db.all("SELECT * FROM room_sensors");
    const currentOccupancy: Record<string, number> = { drawing: 0, work1: 0, work2: 0 };
    sensors.forEach((s) => {
      currentOccupancy[s.room_id] = s.is_occupied === 1 ? s.enter_count - s.exit_count : 0;
    });

    // 2. Process occupancy updates
    if (occupancy && typeof occupancy === "object") {
      const occObj = occupancy as Record<string, unknown>;
      for (const r of Object.keys(occObj)) {
        if (r in currentOccupancy) {
          const nextCount = toOccupantCount(occObj[r]);
          if (currentOccupancy[r] !== nextCount) {
            currentOccupancy[r] = nextCount;
            occupancyUpdated = true;
            // Write to DB
            const active = nextCount > 0 ? 1 : 0;
            await db.run(
              "UPDATE room_sensors SET is_occupied = ?, enter_count = ?, exit_count = 0, last_motion_at = ? WHERE room_id = ?",
              [active, nextCount, nowIso, r]
            );
          }
        }
      }
    } else if (room && (typeof isOccupied === "boolean" || typeof occupantCount === "number")) {
      if (room in currentOccupancy) {
        const nextCount = typeof occupantCount === "number" ? toOccupantCount(occupantCount) : toOccupantCount(isOccupied);
        if (currentOccupancy[room] !== nextCount) {
          currentOccupancy[room] = nextCount;
          occupancyUpdated = true;
          // Write to DB
          const active = nextCount > 0 ? 1 : 0;
          await db.run(
            "UPDATE room_sensors SET is_occupied = ?, enter_count = ?, exit_count = 0, last_motion_at = ? WHERE room_id = ?",
            [active, nextCount, nowIso, room]
          );
        }
      }
    }

    if (occupancyUpdated) {
      for (const r of Object.keys(currentOccupancy)) {
        if (currentOccupancy[r] > 0) {
          await ensureOccupiedRoomsHaveBaselinePowerSql(db, r);
        }
      }
      broadcast("occupancy_update", currentOccupancy);
    }

    // 3. Update today's energy if provided
    let updatedKwh = todayKwh;
    if (typeof todayKwh === "number") {
      await db.run(
        "INSERT OR REPLACE INTO system_state (key, value) VALUES ('today_kwh', ?)",
        [String(todayKwh)]
      );
      updatedKwh = todayKwh;

      // Broadcast usage update
      const devices = await db.all<DeviceRow[]>("SELECT * FROM devices");
      let totalWatts = 0;
      const perRoomWatts: Record<string, number> = { drawing: 0, work1: 0, work2: 0 };
      devices.forEach((d) => {
        if (d.is_on === 1) {
          totalWatts += d.rated_power_watts;
          perRoomWatts[d.room_id] = (perRoomWatts[d.room_id] || 0) + d.rated_power_watts;
        }
      });

      broadcast("usage_update", {
        totalWattsNow: totalWatts,
        todayKwh: updatedKwh,
        perRoom: perRoomWatts,
      });
    } else {
      const todayKwhRow = await db.get("SELECT value FROM system_state WHERE key = 'today_kwh'");
      updatedKwh = todayKwhRow ? parseFloat(todayKwhRow.value) : 4.85;
    }

    // 4. Retrieve final devices state
    const currentDeviceRows = await db.all<DeviceRow[]>("SELECT * FROM devices");
    const updatedDevices = currentDeviceRows.map((d) => ({
      id: d.id,
      type: d.type,
      room: d.room_id,
      label: d.name,
      status: d.is_on === 1 ? "on" : "off",
      wattage: d.rated_power_watts,
      lastChanged: d.last_changed,
    }));

    return NextResponse.json({
      devices: updatedDevices,
      occupancy: currentOccupancy,
      todayKwh: updatedKwh,
    });
  } catch (error) {
    console.error("Simulate POST Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function ensureOccupiedRoomsHaveBaselinePowerSql(dbConn: Database, room: string) {
  const roomDevices = await dbConn.all<DeviceRow[]>("SELECT * FROM devices WHERE room_id = ?", [room]);
  const hasActiveDevice = roomDevices.some((d: DeviceRow) => d.is_on === 1);
  if (hasActiveDevice) return;

  const nowIso = new Date().toISOString();
  for (const d of roomDevices) {
    if ((d.type === "fan" && d.name === "Fan 1") || (d.type === "light" && d.name === "Light 1")) {
      await dbConn.run("UPDATE devices SET is_on = 1, last_changed = ? WHERE id = ?", [nowIso, d.id]);
      broadcast("device_update", {
        id: d.id,
        type: d.type,
        room: d.room_id,
        label: d.name,
        status: "on",
        wattage: d.rated_power_watts,
        lastChanged: nowIso,
      });
    }
  }
}
