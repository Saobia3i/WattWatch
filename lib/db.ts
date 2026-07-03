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

// Global server-side fallback simulation to ensure activity even if Python is not running
let isSimulating = false;

export function startServerSimulator() {
  if (isSimulating) return;
  isSimulating = true;
  console.log("[Server Simulator] Starting fallback activity generator...");

  const vacantSince: Record<string, number | null> = { drawing: null, work1: null, work2: null };
  const alertsSent: Record<string, boolean> = { drawing: false, work1: false, work2: false };

  setInterval(() => {
    // 1. Randomly toggle occupancy status (Drawing, Work 1, Work 2)
    const rooms = ["drawing", "work1", "work2"];
    rooms.forEach((r) => {
      // 10% chance to toggle occupancy status in each tick
      if (Math.random() < 0.10) {
        const wasOccupied = db.occupancy[r];
        db.occupancy[r] = !db.occupancy[r];

        if (wasOccupied && !db.occupancy[r]) {
          vacantSince[r] = Date.now();
          alertsSent[r] = false;
        } else if (!wasOccupied && db.occupancy[r]) {
          vacantSince[r] = null;
          alertsSent[r] = false;
        }
      }
    });

    // 2. Randomly toggle devices (simulate office activity)
    if (Math.random() < 0.20) {
      const randomIndex = Math.floor(Math.random() * db.devices.length);
      const dev = db.devices[randomIndex];
      dev.status = dev.status === "on" ? "off" : "on";
      dev.lastChanged = new Date().toISOString();
      broadcast("device_update", dev);
    }

    // 3. Accumulate simulated kWh
    let totalWatts = 0;
    const perRoomWatts = { drawing: 0, work1: 0, work2: 0 };
    db.devices.forEach((d) => {
      if (d.status === "on") {
        totalWatts += d.wattage;
        perRoomWatts[d.room] += d.wattage;
      }
    });

    // Add kWh consumption (representing 3 seconds tick duration)
    const increment = ((totalWatts || 120) * 3) / (3600 * 1000);
    db.todayKwh += increment;
    
    broadcast("usage_update", {
      totalWattsNow: totalWatts,
      todayKwh: db.todayKwh,
      perRoom: perRoomWatts,
    });

    // 4. Check 15-minute vacant rules (simulated as 15 seconds)
    const now = Date.now();
    rooms.forEach((r) => {
      const roomVacant = !db.occupancy[r];
      if (roomVacant) {
        const activeDevs = db.devices.filter((d) => d.room === r && d.status === "on");
        if (activeDevs.length > 0) {
          if (!vacantSince[r]) {
            vacantSince[r] = now;
          }
          const elapsedSec = (now - (vacantSince[r] || now)) / 1000;
          if (elapsedSec >= 15 && !alertsSent[r]) {
            const devLabels = activeDevs.map((d) => d.label).join(", ");
            const newAlert: Alert = {
              id: `alert-vacant-${r}-${now}`,
              severity: "warning",
              message: `Electricity Waste Alert: ${r.toUpperCase()} is unoccupied, but [${devLabels}] are still ON! Turn off room electricity.`,
              room: r,
              timestamp: new Date().toISOString(),
            };
            db.alerts.unshift(newAlert);
            broadcast("alert", newAlert);
            alertsSent[r] = true;
          }
        } else {
          vacantSince[r] = null;
          alertsSent[r] = false;
        }
      }
    });

    // 5. Broadcast occupancy changes to all clients
    broadcast("occupancy_update", db.occupancy);
  }, 3000);
}

// Auto-start simulator in development mode
if (process.env.NODE_ENV !== "production") {
  startServerSimulator();
}
