"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Device, Alert, UsageStats, SSE_STREAM_URL } from "../lib/api-client";

// Helper to initialize 15 devices (2 fans, 3 lights per room * 3 rooms = 15 devices)
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

function sameOccupancy(a: Record<string, number>, b: Record<string, number>) {
  return ROOM_KEYS.every((room) => a[room] === b[room]);
}

function dedupeAlerts(alerts: Alert[]) {
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

function clampOccupantCount(value: number) {
  return Math.max(0, Math.min(MAX_OCCUPANTS_PER_ROOM, Math.round(value)));
}

function toOccupantCount(value: unknown) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampOccupantCount(value);
  }
  return 0;
}

function normalizeOccupancy(payload: Record<string, unknown>) {
  return ROOM_KEYS.reduce<Record<string, number>>((next, room) => {
    next[room] = toOccupantCount(payload[room]);
    return next;
  }, {});
}

function nextOccupantCount(currentCount: number) {
  const current = clampOccupantCount(currentCount);
  if (current === 0) return 1;
  if (current === MAX_OCCUPANTS_PER_ROOM) return MAX_OCCUPANTS_PER_ROOM - 1;
  return clampOccupantCount(current + (Math.random() > 0.45 ? 1 : -1));
}

function getOptionalDevices(devices: Device[], room: RoomKey) {
  return devices.filter(
    (device) =>
      device.room === room &&
      !(
        (device.type === "fan" && device.label === "Fan 1") ||
        (device.type === "light" && device.label === "Light 1")
      )
  );
}

function ensureBaselinePower(devices: Device[], room: RoomKey) {
  const hasActiveDevice = devices.some((device) => device.room === room && device.status === "on");
  if (hasActiveDevice) return devices;

  const now = new Date().toISOString();
  return devices.map((device) => {
    const isBaseline =
      device.room === room &&
      ((device.type === "fan" && device.label === "Fan 1") ||
        (device.type === "light" && device.label === "Light 1"));

    return isBaseline ? { ...device, status: "on" as const, lastChanged: now } : device;
  });
}

export function useLiveOffice() {
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [occupancy, setOccupancy] = useState<Record<string, number>>({
    drawing: 1,
    work1: 3,
    work2: 2,
  });
  const [todayKwh, setTodayKwh] = useState(4.85);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "mock">("reconnecting");

  // Keep references to state for use in callbacks / timers
  const devicesRef = useRef(devices);
  const alertsRef = useRef(alerts);
  const occupancyRef = useRef(occupancy);
  const vacantSinceRef = useRef<Record<RoomKey, number | null>>({
    drawing: null,
    work1: null,
    work2: null,
  });
  const emptyRoomAlertSentRef = useRef<Record<RoomKey, boolean>>({
    drawing: false,
    work1: false,
    work2: false,
  });
  const nextOccupancyTransitionAtRef = useRef<Record<RoomKey, number>>({
    drawing: 0,
    work1: 0,
    work2: 0,
  });
  const nextDeviceTelemetryAtRef = useRef<Record<RoomKey, number>>({
    drawing: 0,
    work1: 0,
    work2: 0,
  });

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    occupancyRef.current = occupancy;
  }, [occupancy]);

  // Derive active load per room and total load
  let totalWattsNow = 0;
  const perRoomWatts = { drawing: 0, work1: 0, work2: 0 };

  devices.forEach((d) => {
    if (d.status === "on") {
      totalWattsNow += d.wattage;
      perRoomWatts[d.room] += d.wattage;
    }
  });

  const usage: UsageStats = {
    totalWattsNow,
    todayKwh,
    perRoom: perRoomWatts,
  };

  const setDeviceStatus = useCallback((id: string, status: Device["status"]) => {
    const lastChanged = new Date().toISOString();

    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status, lastChanged } : d))
    );

    if (connectionStatus !== "mock") {
      fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      }).catch((err) => {
        console.error("Failed to update device telemetry:", err);
      });
    }
  }, [connectionStatus]);

  // Clear an alert
  const clearAlert = useCallback((id: string) => {
    // Local optimistic update
    setAlerts((prev) => prev.filter((a) => a.id !== id));

    // Call API
    if (connectionStatus !== "mock") {
      fetch(`/api/alerts?id=${id}`, {
        method: "DELETE",
      }).catch((err) => {
        console.error("Failed to clear alert via API:", err);
      });
    }
  }, [connectionStatus]);

  // Effect 1: SSE Subscription & Connection Management (Runs ONLY once on mount)
  useEffect(() => {
    let sse: EventSource | null = null;
    let fallbackTimer: NodeJS.Timeout;

    const connectSSE = () => {
      try {
        setConnectionStatus("reconnecting");
        sse = new EventSource(SSE_STREAM_URL);

        sse.onopen = () => {
          console.log("SSE Connection established successfully.");
          setConnectionStatus("connected");
          clearTimeout(fallbackTimer);

          // Fetch initial state from DB
          fetch("/api/devices")
            .then((r) => r.json())
            .then((data) => setDevices(data))
            .catch((e) => console.error("Error fetching devices:", e));

          fetch("/api/alerts")
            .then((r) => r.json())
            .then((data) => setAlerts(dedupeAlerts(data)))
            .catch((e) => console.error("Error fetching alerts:", e));

          fetch("/api/simulate")
            .then((r) => r.json())
            .then((data) => {
              if (data) {
                if (typeof data.todayKwh === "number") {
                  setTodayKwh(data.todayKwh);
                }
                if (data.occupancy) {
                  const nextOccupancy = normalizeOccupancy(data.occupancy);
                  setOccupancy((prev) =>
                    sameOccupancy(prev, nextOccupancy) ? prev : nextOccupancy
                  );
                }
              }
            })
            .catch((e) => console.error("Error fetching usage/simulation config:", e));
        };

        sse.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "device_update") {
              const updatedDevice = data.payload as Device;
              setDevices((prev) =>
                prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d))
              );
            } else if (data.type === "alert") {
              const newAlert = data.payload as Alert;
              setAlerts((prev) => {
                if (prev.some((a) => a.id === newAlert.id)) return prev;
                return dedupeAlerts([newAlert, ...prev]);
              });
            } else if (data.type === "usage_update") {
              if (data.payload && typeof data.payload.todayKwh === "number") {
                setTodayKwh(data.payload.todayKwh);
              }
            } else if (data.type === "occupancy_update") {
              if (data.payload) {
                const nextOccupancy = normalizeOccupancy(data.payload as Record<string, unknown>);
                setOccupancy((prev) =>
                  sameOccupancy(prev, nextOccupancy) ? prev : nextOccupancy
                );
              }
            }
          } catch (e) {
            console.error("Error parsing SSE event data:", e);
          }
        };

        sse.onerror = () => {
          console.warn("SSE connection error. Retrying...");
          setConnectionStatus("reconnecting");
          
          // Fallback to mock mode if we fail to connect within 3 seconds
          clearTimeout(fallbackTimer);
          fallbackTimer = setTimeout(() => {
            setConnectionStatus((prev) => {
              if (prev !== "connected") {
                console.log("SSE unavailable. Activating local simulator fallback.");
                if (sse) {
                  sse.close();
                  sse = null;
                }
                return "mock";
              }
              return prev;
            });
          }, 3000);
        };
      } catch (err) {
        console.error("Failed to connect to SSE:", err);
        setConnectionStatus("mock");
      }
    };

    // Attempt connection
    connectSSE();

    return () => {
      if (sse) sse.close();
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Effect 2: Local Simulator Logic (Active only when connectionStatus === 'mock')
  useEffect(() => {
    if (connectionStatus !== "mock") return;

    console.log("[Simulator] SSE unavailable. Running slow local office telemetry.");
    const initialNow = Date.now();
    ROOM_KEYS.forEach((room) => {
        if (nextOccupancyTransitionAtRef.current[room] === 0) {
          nextOccupancyTransitionAtRef.current[room] =
            initialNow + nextOccupancyDelay(occupancyRef.current[room]);
      }
      if (nextDeviceTelemetryAtRef.current[room] === 0) {
        nextDeviceTelemetryAtRef.current[room] = initialNow + nextDeviceTelemetryDelay();
      }
    });

    // Slow office telemetry, energy accumulation, and delayed vacant-room alerts.
    const energyAccumulationTimer = setInterval(() => {
      const nowMs = Date.now();

      ROOM_KEYS.forEach((room) => {
        if (nowMs < nextOccupancyTransitionAtRef.current[room]) return;

        const currentOccupancy = occupancyRef.current;
        const previousCount = currentOccupancy[room] ?? 0;
        const nextCount = nextOccupantCount(previousCount);
        nextOccupancyTransitionAtRef.current[room] = nowMs + nextOccupancyDelay(nextCount);
        setOccupancy((prev) => ({ ...prev, [room]: nextCount }));

        if (nextCount > 0) {
          vacantSinceRef.current[room] = null;
          emptyRoomAlertSentRef.current[room] = false;
          setDevices((prev) => ensureBaselinePower(prev, room));
        } else if (previousCount > 0) {
          vacantSinceRef.current[room] = nowMs;
          emptyRoomAlertSentRef.current[room] = false;
        }
      });

      ROOM_KEYS.forEach((room) => {
        if (nowMs < nextDeviceTelemetryAtRef.current[room]) return;
        nextDeviceTelemetryAtRef.current[room] = nowMs + nextDeviceTelemetryDelay();

        const optionalDevices = getOptionalDevices(devicesRef.current, room);
        if (optionalDevices.length === 0) return;

        const selectedDevice = optionalDevices[Math.floor(Math.random() * optionalDevices.length)];
        const lastChanged = new Date().toISOString();
        setDevices((prev) =>
          prev.map((device) =>
            device.id === selectedDevice.id
              ? {
                  ...device,
                  status: device.status === "on" ? "off" : "on",
                  lastChanged,
                }
              : device
          )
        );
      });

      const currentDevices = devicesRef.current;
      let totalWatts = 0;
      currentDevices.forEach((d) => {
        if (d.status === "on") {
          totalWatts += d.wattage;
        }
      });

      const currentDraw = totalWatts > 0 ? totalWatts : 120;
      const incrementKwh = (currentDraw * 1) / (3600 * 1000);

      setTodayKwh((prev) => Number((prev + incrementKwh).toFixed(5)));

      ROOM_KEYS.forEach((room) => {
        if ((occupancyRef.current[room] ?? 0) > 0) {
          vacantSinceRef.current[room] = null;
          emptyRoomAlertSentRef.current[room] = false;
          return;
        }

        const activeDevices = currentDevices.filter((d) => d.room === room && d.status === "on");
        if (activeDevices.length === 0) {
          vacantSinceRef.current[room] = null;
          emptyRoomAlertSentRef.current[room] = false;
          return;
        }

        if (!vacantSinceRef.current[room]) {
          vacantSinceRef.current[room] = nowMs;
        }

        const elapsedMs = nowMs - (vacantSinceRef.current[room] || nowMs);
        if (elapsedMs < EMPTY_ROOM_ALERT_DELAY_MS || emptyRoomAlertSentRef.current[room]) {
          return;
        }

        const devLabels = activeDevices.map((d) => d.label).join(", ");
        const alertId = `alert-vacant-${room}-${nowMs}`;
        const alertMsg = `Electricity Waste Alert: ${room.toUpperCase()} has been unoccupied for 15 minutes, but [${devLabels}] are still ON! Turn off room electricity.`;

        emptyRoomAlertSentRef.current[room] = true;
        setAlerts((prevAlerts) =>
          dedupeAlerts([
            {
              id: alertId,
              severity: "warning",
              message: alertMsg,
              room,
              timestamp: new Date().toISOString(),
            },
            ...prevAlerts,
          ])
        );
      });
    }, 1000);

    return () => {
      clearInterval(energyAccumulationTimer);
    };
  }, [connectionStatus]);

  return {
    devices,
    alerts,
    usage,
    occupancy,
    connectionStatus,
    setDeviceStatus,
    clearAlert,
  };
}
