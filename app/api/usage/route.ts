export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";
import { UsageStats } from "../../../lib/api-client";

export async function GET() {
  try {
    const db = await getDb();

    // 1. Fetch all devices to compute current load
    const devices = await db.all("SELECT * FROM devices");
    let totalWattsNow = 0;
    const perRoom: Record<string, number> = { drawing: 0, work1: 0, work2: 0 };

    devices.forEach((d) => {
      if (d.is_on === 1) {
        totalWattsNow += d.rated_power_watts;
        perRoom[d.room_id] = (perRoom[d.room_id] || 0) + d.rated_power_watts;
      }
    });

    // 2. Fetch today's energy from system_state
    const todayKwhRow = await db.get("SELECT value FROM system_state WHERE key = 'today_kwh'");
    const todayKwh = todayKwhRow ? parseFloat(todayKwhRow.value) : 4.85;

    const usageStats: UsageStats = {
      totalWattsNow,
      todayKwh,
      perRoom,
    };

    return NextResponse.json(usageStats);
  } catch (error) {
    console.error("Usage GET Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
