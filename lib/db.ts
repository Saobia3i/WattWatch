import { Device, Alert } from "./api-client";

interface DbState {
  devices: Device[];
  alerts: Alert[];
  occupancy: Record<string, number>;
  todayKwh: number;
}

const INITIAL_DEVICES: Device[] = [
  // Drawing Room (drawing)
  { id: "drawing-fan-1", type: "fan", room: "drawing", label: "Fan 1", status: "on", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "drawing-fan-2", type: "fan", room: "drawing", label: "Fan 2", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "drawing-light-1", type: "light", room: "drawing", label: "Light 1", status: "on", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "drawing-light-2", type: "light", room: "drawing", label: "Light 2", status: "on", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "drawing-light-3", type: "light", room: "drawing", label: "Light 3", status: "off", wattage: 15, lastChanged: new Date().toISOString() },

  // Work Room 1 (work1)
  { id: "work1-fan-1", type: "fan", room: "work1", label: "Fan 1", status: "on", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work1-fan-2", type: "fan", room: "work1", label: "Fan 2", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work1-light-1", type: "light", room: "work1", label: "Light 1", status: "on", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work1-light-2", type: "light", room: "work1", label: "Light 2", status: "on", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work1-light-3", type: "light", room: "work1", label: "Light 3", status: "off", wattage: 15, lastChanged: new Date().toISOString() },

  // Work Room 2 (work2)
  { id: "work2-fan-1", type: "fan", room: "work2", label: "Fan 1", status: "on", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work2-fan-2", type: "fan", room: "work2", label: "Fan 2", status: "off", wattage: 60, lastChanged: new Date().toISOString() },
  { id: "work2-light-1", type: "light", room: "work2", label: "Light 1", status: "on", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work2-light-2", type: "light", room: "work2", label: "Light 2", status: "off", wattage: 15, lastChanged: new Date().toISOString() },
  { id: "work2-light-3", type: "light", room: "work2", label: "Light 3", status: "on", wattage: 15, lastChanged: new Date().toISOString() },
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
    occupancy: { drawing: 1, work1: 3, work2: 2 },
    todayKwh: 4.85,
  };
} else {
  const globalRecords = global as unknown as Record<string, unknown>;
  if (!globalRecords._db) {
    globalRecords._db = {
      devices: INITIAL_DEVICES,
      alerts: INITIAL_ALERTS,
      occupancy: { drawing: 1, work1: 3, work2: 2 },
      todayKwh: 4.85,
    };
  }
  db = globalRecords._db as DbState;
}

export { db };

const ROOM_KEYS = ["drawing", "work1", "work2"] as const;
type RoomKey = (typeof ROOM_KEYS)[number];
const EMPTY_ROOM_ALERT_DELAY_MS = 15 * 60 * 1000;
const MAX_ALERTS = 50;
const MAX_OCCUPANTS_PER_ROOM = 4;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function nextOccupancyDelay(occupantCount: number) {
  return occupantCount > 0
    ? randomBetween(6 * 60 * 1000, 12 * 60 * 1000)
    : randomBetween(3 * 60 * 1000, 7 * 60 * 1000);
}

function nextDeviceTelemetryDelay() {
  return randomBetween(4 * 60 * 1000, 9 * 60 * 1000);
}

function clampOccupantCount(value: number) {
  return Math.max(0, Math.min(MAX_OCCUPANTS_PER_ROOM, Math.round(value)));
}

export function toOccupantCount(value: unknown) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampOccupantCount(value);
  }
  return 0;
}

function nextOccupantCount(currentCount: number) {
  const current = clampOccupantCount(currentCount);
  if (current === 0) return 1;
  if (current === MAX_OCCUPANTS_PER_ROOM) return MAX_OCCUPANTS_PER_ROOM - 1;
  return clampOccupantCount(current + (Math.random() > 0.45 ? 1 : -1));
}

ROOM_KEYS.forEach((room) => {
  db.occupancy[room] = toOccupantCount(db.occupancy[room]);
});

function getOptionalDevices(room: RoomKey) {
  return db.devices.filter(
    (device) =>
      device.room === room &&
      !(
        (device.type === "fan" && device.label === "Fan 1") ||
        (device.type === "light" && device.label === "Light 1")
      )
  );
}

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

export function dedupeAlerts(alerts: Alert[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = alert.id || `${alert.room ?? "office"}-${alert.severity}-${alert.message}-${alert.timestamp}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function addAlert(alert: Alert) {
  db.alerts = dedupeAlerts(db.alerts);
  if (db.alerts.some((existing) => existing.id === alert.id || existing.message === alert.message)) {
    return false;
  }

  db.alerts.unshift(alert);
  db.alerts = dedupeAlerts(db.alerts).slice(0, MAX_ALERTS);
  broadcast("alert", alert);
  return true;
}

export function ensureOccupiedRoomsHaveBaselinePower(occupancy: Record<string, number>) {
  ROOM_KEYS.forEach((room) => {
    if (occupancy[room] <= 0) return;

    const roomDevices = db.devices.filter((device) => device.room === room);
    const hasActiveDevice = roomDevices.some((device) => device.status === "on");
    if (hasActiveDevice) return;

    const baselineDevices = roomDevices.filter(
      (device) =>
        (device.type === "fan" && device.label === "Fan 1") ||
        (device.type === "light" && device.label === "Light 1")
    );

    baselineDevices.forEach((device) => {
      device.status = "on";
      device.lastChanged = new Date().toISOString();
      broadcast("device_update", device);
    });
  });
}

// Global server-side fallback simulation to ensure activity even if Python is not running
const globalRecords = global as unknown as Record<string, unknown>;
if (process.env.NODE_ENV !== "production" && typeof globalRecords._wattWatchSimulating !== "boolean") {
  globalRecords._wattWatchSimulating = false;
}

function getIsSimulating() {
  return process.env.NODE_ENV === "production"
    ? Boolean(globalRecords._wattWatchProdSimulating)
    : Boolean(globalRecords._wattWatchSimulating);
}

function setIsSimulating(value: boolean) {
  if (process.env.NODE_ENV === "production") {
    globalRecords._wattWatchProdSimulating = value;
  } else {
    globalRecords._wattWatchSimulating = value;
  }
}

export function startServerSimulator() {
  if (getIsSimulating()) return;
  setIsSimulating(true);
  console.log("[Server Simulator] Starting fallback activity generator...");

  const vacantSince: Record<RoomKey, number | null> = { drawing: null, work1: null, work2: null };
  const alertsSent: Record<RoomKey, boolean> = { drawing: false, work1: false, work2: false };
  const nextOccupancyTransitionAt: Record<RoomKey, number> = {
    drawing: Date.now() + nextOccupancyDelay(db.occupancy.drawing),
    work1: Date.now() + nextOccupancyDelay(db.occupancy.work1),
    work2: Date.now() + nextOccupancyDelay(db.occupancy.work2),
  };
  const nextDeviceTelemetryAt: Record<RoomKey, number> = {
    drawing: Date.now() + nextDeviceTelemetryDelay(),
    work1: Date.now() + nextDeviceTelemetryDelay(),
    work2: Date.now() + nextDeviceTelemetryDelay(),
  };

  setInterval(() => {
    const now = Date.now();

    // 1. Slow scripted people-count simulation: minutes-scale, never twitchy.
    ROOM_KEYS.forEach((room) => {
      if (now < nextOccupancyTransitionAt[room]) return;

      const previousCount = db.occupancy[room];
      const nextCount = nextOccupantCount(previousCount);
      db.occupancy[room] = nextCount;
      nextOccupancyTransitionAt[room] = now + nextOccupancyDelay(nextCount);

      if (nextCount > 0) {
        vacantSince[room] = null;
        alertsSent[room] = false;
        ensureOccupiedRoomsHaveBaselinePower(db.occupancy);
      } else if (previousCount > 0) {
        vacantSince[room] = now;
        alertsSent[room] = false;
      }

      broadcast("occupancy_update", db.occupancy);
    });

    // 2. Slow device telemetry for non-baseline devices.
    ROOM_KEYS.forEach((room) => {
      if (now < nextDeviceTelemetryAt[room]) return;
      nextDeviceTelemetryAt[room] = now + nextDeviceTelemetryDelay();

      const optionalDevices = getOptionalDevices(room);
      if (optionalDevices.length === 0) return;

      const device = optionalDevices[Math.floor(Math.random() * optionalDevices.length)];
      device.status = device.status === "on" ? "off" : "on";
      device.lastChanged = new Date().toISOString();
      broadcast("device_update", device);
    });

    // 3. Accumulate kWh from the current device state.
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

    // 4. Check 15-minute vacant rules.
    ROOM_KEYS.forEach((r) => {
      const roomVacant = db.occupancy[r] <= 0;
      if (roomVacant) {
        const activeDevs = db.devices.filter((d) => d.room === r && d.status === "on");
        if (activeDevs.length > 0) {
          if (!vacantSince[r]) {
            vacantSince[r] = now;
          }
          const elapsedSec = (now - (vacantSince[r] || now)) / 1000;
          if (elapsedSec >= EMPTY_ROOM_ALERT_DELAY_MS / 1000 && !alertsSent[r]) {
            const devLabels = activeDevs.map((d) => d.label).join(", ");
            const newAlert: Alert = {
              id: `alert-vacant-${r}-${now}`,
              severity: "warning",
              message: `Electricity Waste Alert: ${r.toUpperCase()} has been unoccupied for 15 minutes, but [${devLabels}] are still ON! Turn off room electricity.`,
              room: r,
              timestamp: new Date().toISOString(),
            };
            if (addAlert(newAlert)) {
              alertsSent[r] = true;
            }
          }
        } else {
          vacantSince[r] = null;
          alertsSent[r] = false;
        }
      } else {
        vacantSince[r] = null;
        alertsSent[r] = false;
      }
    });

  }, 3000);
}

// Auto-start simulator in development mode
if (process.env.NODE_ENV !== "production") {
  startServerSimulator();
}
