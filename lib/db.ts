import { Device, Alert } from "./api-client";

interface DbState {
  devices: Device[];
  alerts: Alert[];
  occupancy: Record<string, boolean>;
  todayKwh: number;
}

const INITIAL_DEVICES: Device[] = [
  // Drawing Room (drawing)
  { id: "drawing-fan-1", type: "fan", room: "drawing", label: "Fan 1", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "drawing-fan-2", type: "fan", room: "drawing", label: "Fan 2", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "drawing-light-1", type: "light", room: "drawing", label: "Light 1", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "drawing-light-2", type: "light", room: "drawing", label: "Light 2", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "drawing-light-3", type: "light", room: "drawing", label: "Light 3", status: "off", wattage: 15, lastChanged: new Date().toISOString() },

  // Work Room 1 (work1)
  { id: "work1-fan-1", type: "fan", room: "work1", label: "Fan 1", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work1-fan-2", type: "fan", room: "work1", label: "Fan 2", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work1-light-1", type: "light", room: "work1", label: "Light 1", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work1-light-2", type: "light", room: "work1", label: "Light 2", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work1-light-3", type: "light", room: "work1", label: "Light 3", status: "off", wattage: 15, lastChanged: new Date().toISOString() },

  // Work Room 2 (work2)
  { id: "work2-fan-1", type: "fan", room: "work2", label: "Fan 1", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work2-fan-2", type: "fan", room: "work2", label: "Fan 2", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work2-light-1", type: "light", room: "work2", label: "Light 1", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work2-light-2", type: "light", room: "work2", label: "Light 2", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work2-light-3", type: "light", room: "work2", label: "Light 3", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
];

const INITIAL_ALERTS: Alert[] = [
  {
    id: "alert-init-1",
    severity: "warning",
    message: "Drawing Room AC or high-draw device detected drawing idle power.",
    room: "drawing",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  }
];

// Global declaration to survive dev server hot-reloads
let db: DbState;

if (process.env.NODE_ENV === "production") {
  db = {
    devices: INITIAL_DEVICES,
    alerts: INITIAL_ALERTS,
    occupancy: { drawing: true, work1: true, work2: true },
    todayKwh: 4.85,
  };
} else {
  const globalRecords = global as unknown as Record<string, unknown>;
  if (!globalRecords._db) {
    globalRecords._db = {
      devices: INITIAL_DEVICES,
      alerts: INITIAL_ALERTS,
      occupancy: { drawing: true, work1: true, work2: true },
      todayKwh: 4.85,
    };
  }
  db = globalRecords._db as DbState;
}

export { db };

// List of connected SSE clients
type SseClient = {
  writer: WritableStreamDefaultWriter;
  encoder: TextEncoder;
};

let clients: SseClient[] = [];

if (process.env.NODE_ENV !== "production") {
  const globalRecords = global as unknown as Record<string, unknown>;
  if (!globalRecords._sseClients) {
    globalRecords._sseClients = [];
  }
  clients = globalRecords._sseClients as SseClient[];
}

export function addConnection(writer: WritableStreamDefaultWriter, encoder: TextEncoder) {
  clients.push({ writer, encoder });
}

export function removeConnection(writer: WritableStreamDefaultWriter) {
  const index = clients.findIndex((c) => c.writer === writer);
  if (index !== -1) {
    clients.splice(index, 1);
  }
}

export function broadcast(type: "device_update" | "alert" | "usage_update" | "occupancy_update", payload: unknown) {
  const data = JSON.stringify({ type, payload });
  const chunk = `data: ${data}\n\n`;
  
  // Clean up failed writers to prevent memory leaks
  const activeClients: SseClient[] = [];
  
  clients.forEach((client) => {
    try {
      client.writer.write(client.encoder.encode(chunk));
      activeClients.push(client);
    } catch (e) {
      console.error("Error writing to SSE stream client, removing:", e);
    }
  });

  clients.length = 0;
  clients.push(...activeClients);
}
