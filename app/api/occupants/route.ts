export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM occupants ORDER BY name ASC");
    
    const occupants = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
    }));
    
    return NextResponse.json(occupants);
  } catch (error) {
    console.error("Occupants GET Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
