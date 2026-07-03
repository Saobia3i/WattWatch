export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { addConnection, removeConnection } from "../../../lib/db";

export async function GET(request: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Add client writer to connection pool
  addConnection(writer, encoder);

  // Send an initial heartbeat/connection confirmation event
  const initMsg = JSON.stringify({ type: "connection", payload: "connected" });
  writer.write(encoder.encode(`data: ${initMsg}\n\n`));

  request.signal.addEventListener("abort", () => {
    removeConnection(writer);
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
