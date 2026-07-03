export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { UsageStats } from "../../../lib/api-client";

export async function GET() {
  let totalWattsNow = 0;
  const perRoom: Record<string, number> = { drawing: 0, work1: 0, work2: 0 };

  db.devices.forEach((d) => {
    if (d.status === "on") {
      totalWattsNow += d.wattage;
      perRoom[d.room] += d.wattage;
    }
  });

  const usageStats: UsageStats = {
    totalWattsNow,
    todayKwh: db.todayKwh,
    perRoom,
  };

  return NextResponse.json(usageStats);
}
