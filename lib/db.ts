import { getDb } from "./sqlite";
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

const ROOM_KEYS = ["drawing", "work1", "work2"] as const;
type RoomKey = (typeof ROOM_KEYS)[number];
const EMPTY_ROOM_ALERT_DELAY_MS = 15 * 60 * 1000;
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

async function ensureOccupiedRoomsHaveBaselinePowerSql(dbConn: Database, room: RoomKey) {
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
  let lastTimeAlertTriggered: string | null = null;
  
  const initialNow = Date.now();
  const nextOccupancyTransitionAt: Record<RoomKey, number> = {
    drawing: initialNow + nextOccupancyDelay(1),
    work1: initialNow + nextOccupancyDelay(3),
    work2: initialNow + nextOccupancyDelay(2),
  };
  const nextDeviceTelemetryAt: Record<RoomKey, number> = {
    drawing: initialNow + nextDeviceTelemetryDelay(),
    work1: initialNow + nextDeviceTelemetryDelay(),
    work2: initialNow + nextDeviceTelemetryDelay(),
  };

  setInterval(async () => {
    try {
      const dbConn = await getDb();
      const now = Date.now();
      const nowIso = new Date().toISOString();

      // 1. Slow occupancy simulation
      const sensors = await dbConn.all("SELECT * FROM room_sensors");
      const occupancy: Record<RoomKey, number> = { drawing: 0, work1: 0, work2: 0 };
      sensors.forEach((s) => {
        occupancy[s.room_id as RoomKey] = s.is_occupied === 1 ? s.enter_count - s.exit_count : 0;
      });

      for (const room of ROOM_KEYS) {
        if (now < nextOccupancyTransitionAt[room]) continue;

        const previousCount = occupancy[room];
        const nextCount = nextOccupantCount(previousCount);
        occupancy[room] = nextCount;
        nextOccupancyTransitionAt[room] = now + nextOccupancyDelay(nextCount);

        const isOccupied = nextCount > 0 ? 1 : 0;
        await dbConn.run(
          "UPDATE room_sensors SET is_occupied = ?, last_motion_at = ? WHERE room_id = ?",
          [isOccupied, nowIso, room]
        );

        if (nextCount > 0) {
          vacantSince[room] = null;
          alertsSent[room] = false;
          await ensureOccupiedRoomsHaveBaselinePowerSql(dbConn, room);
        } else if (previousCount > 0) {
          vacantSince[room] = now;
          alertsSent[room] = false;
        }

        broadcast("occupancy_update", occupancy);
      }

      // 2. Telemetry update for optional devices
      const devices = await dbConn.all<DeviceRow[]>("SELECT * FROM devices");
      for (const room of ROOM_KEYS) {
        if (now < nextDeviceTelemetryAt[room]) continue;
        nextDeviceTelemetryAt[room] = now + nextDeviceTelemetryDelay();

        const optionalDevices = devices.filter(
          (d) =>
            d.room_id === room &&
            !(
              (d.type === "fan" && d.name === "Fan 1") ||
              (d.type === "light" && d.name === "Light 1")
            )
        );
        if (optionalDevices.length === 0) continue;

        const device = optionalDevices[Math.floor(Math.random() * optionalDevices.length)];
        const nextStatus = device.is_on === 1 ? 0 : 1;
        await dbConn.run(
          "UPDATE devices SET is_on = ?, last_changed = ? WHERE id = ?",
          [nextStatus, nowIso, device.id]
        );

        broadcast("device_update", {
          id: device.id,
          type: device.type,
          room: device.room_id,
          label: device.name,
          status: nextStatus === 1 ? "on" : "off",
          wattage: device.rated_power_watts,
          lastChanged: nowIso,
        });
      }

      // 3. Accumulate energy kWh
      const currentDevices = await dbConn.all<DeviceRow[]>("SELECT * FROM devices");
      let totalWatts = 0;
      const perRoomWatts = { drawing: 0, work1: 0, work2: 0 };
      currentDevices.forEach((d) => {
        if (d.is_on === 1) {
          totalWatts += d.rated_power_watts;
          perRoomWatts[d.room_id as RoomKey] += d.rated_power_watts;
        }
      });

      const todayKwhRow = await dbConn.get("SELECT value FROM system_state WHERE key = 'today_kwh'");
      let todayKwhVal = todayKwhRow ? parseFloat(todayKwhRow.value) : 4.85;

      const increment = ((totalWatts || 120) * 3) / (3600 * 1000);
      todayKwhVal = parseFloat((todayKwhVal + increment).toFixed(5));

      await dbConn.run(
        "INSERT OR REPLACE INTO system_state (key, value) VALUES ('today_kwh', ?)",
        [String(todayKwhVal)]
      );

      broadcast("usage_update", {
        totalWattsNow: totalWatts,
        todayKwh: todayKwhVal,
        perRoom: perRoomWatts,
      });

      // 4. Delayed vacant-room alert checks (15 minutes empty but devices still ON)
      for (const r of ROOM_KEYS) {
        const roomVacant = occupancy[r] <= 0;
        if (roomVacant) {
          const activeDevs = currentDevices.filter((d) => d.room_id === r && d.is_on === 1);
          if (activeDevs.length > 0) {
            if (!vacantSince[r]) {
              vacantSince[r] = now;
            }
            const elapsedSec = (now - (vacantSince[r] || now)) / 1000;
            if (elapsedSec >= EMPTY_ROOM_ALERT_DELAY_MS / 1000 && !alertsSent[r]) {
              const devLabels = activeDevs.map((d) => d.name).join(", ");
              const alertId = `alert-vacant-${r}-${now}`;
              const alertMsg = `Electricity Waste Alert: ${r.toUpperCase()} has been unoccupied for 15 minutes, but [${devLabels}] are still ON! Turn off room electricity.`;

              await dbConn.run(
                "INSERT INTO alerts (id, room_id, severity, message, is_active, triggered_at) VALUES (?, ?, 'warning', ?, 1, ?)",
                [alertId, r, alertMsg, nowIso]
              );
              alertsSent[r] = true;
              broadcast("alert", {
                id: alertId,
                severity: "warning",
                message: alertMsg,
                room: r,
                timestamp: nowIso,
              });
            }
          } else {
            vacantSince[r] = null;
            alertsSent[r] = false;
          }
        }
      }

      // 5. Proactive time-of-day alert checks (10:00 PM and 3:15 PM/AM testing)
      const localTime = new Date();
      const localHours = localTime.getHours();
      const localMinutes = localTime.getMinutes();
      const timeKey = `${localHours}:${localMinutes}`;
      const isTargetTime = (localHours === 15 && localMinutes === 15) || 
                           (localHours === 3 && localMinutes === 15) || 
                           (localHours === 22 && localMinutes === 0);

      if (isTargetTime && lastTimeAlertTriggered !== timeKey) {
        lastTimeAlertTriggered = timeKey;
        const timeFormatted = localHours === 22 ? "10 PM" : (localHours === 15 ? "3:15 PM" : "3:15 AM");
        
        for (const r of ROOM_KEYS) {
          const roomDevices = currentDevices.filter((d) => d.room_id === r && d.is_on === 1);
          if (roomDevices.length > 0) {
            const fans = roomDevices.filter((d) => d.type === "fan").length;
            const lights = roomDevices.filter((d) => d.type === "light").length;
            
            const partsList: string[] = [];
            if (fans > 0) partsList.push(`${fans} fan${fans > 1 ? "s" : ""}`);
            if (lights > 0) partsList.push(`${lights} light${lights > 1 ? "s" : ""}`);
            const deviceDescription = partsList.join(" and ");
            
            const roomName = r === "drawing" ? "Drawing Room" : (r === "work1" ? "Work Room 1" : "Work Room 2");
            const alertMsg = `⚠️ Hey! ${roomName} still has ${deviceDescription} ON and it's ${timeFormatted}. Did someone forget to leave?`;
            const alertId = `alert-time-${r}-${now}`;
            
            await dbConn.run(
              "INSERT INTO alerts (id, room_id, severity, message, is_active, triggered_at) VALUES (?, ?, 'warning', ?, 1, ?)",
              [alertId, r, alertMsg, nowIso]
            );
            
            broadcast("alert", {
              id: alertId,
              severity: "warning",
              message: alertMsg,
              room: r,
              timestamp: nowIso,
            });
            console.log(`[Server Simulator] Time-of-day alert triggered: ${alertMsg}`);
          }
        }
      }
    } catch (err) {
      console.error("[Server Simulator] Loop Error:", err);
    }
  }, 3000);
}

// Start local simulator in all modes (production & dev) to keep DB dynamic
startServerSimulator();
