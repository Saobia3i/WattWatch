export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDb } from "../../../lib/sqlite";

const FALLBACK_OCCUPANTS = [
  {
    id: "nafisa",
    name: "Nafisa Rahman",
    email: "nafisa.rahman@yahoo.com",
    phone: "+8801812345678",
  },
  {
    id: "tanvir",
    name: "Tanvir Hossain",
    email: "tanvir.hossain@yahoo.com",
    phone: "+8801912345678",
  },
];

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
    
    return NextResponse.json(occupants.length > 0 ? occupants : FALLBACK_OCCUPANTS);
  } catch (error) {
    console.error("Occupants GET Error:", error);
    return NextResponse.json(FALLBACK_OCCUPANTS);
  }
}
