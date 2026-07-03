"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Device, Alert, UsageStats, SSE_STREAM_URL } from "../lib/api-client";

// Helper to initialize 15 devices (2 fans, 3 lights per room * 3 rooms = 15 devices)
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

export function useLiveOffice() {
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [occupancy, setOccupancy] = useState<Record<string, boolean>>({
    drawing: true,
    work1: true,
    work2: true,
  });
  const [todayKwh, setTodayKwh] = useState(4.85);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "mock">("reconnecting");

  // Keep references to state for use in callbacks / timers
  const devicesRef = useRef(devices);
  const alertsRef = useRef(alerts);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

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

  // Toggle a device state manually
  const toggleDevice = useCallback((id: string) => {
    // Optimistic UI update
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          return {
            ...d,
            status: d.status === "on" ? "off" : "on",
            lastChanged: new Date().toISOString(),
          };
        }
        return d;
      })
    );

    // Call API (will broadcast update to SSE clients)
    if (connectionStatus !== "mock") {
      fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch((err) => {
        console.error("Failed to toggle device via API:", err);
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
            .then((data) => setAlerts(data))
            .catch((e) => console.error("Error fetching alerts:", e));

          fetch("/api/simulate")
            .then((r) => r.json())
            .then((data) => {
              if (data) {
                if (typeof data.todayKwh === "number") {
                  setTodayKwh(data.todayKwh);
                }
                if (data.occupancy) {
                  setOccupancy(data.occupancy);
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
                return [newAlert, ...prev];
              });
            } else if (data.type === "usage_update") {
              if (data.payload && typeof data.payload.todayKwh === "number") {
                setTodayKwh(data.payload.todayKwh);
              }
            } else if (data.type === "occupancy_update") {
              if (data.payload) {
                setOccupancy(data.payload as Record<string, boolean>);
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

    console.log("[Simulator] Starting background mock simulator loops.");

    // Randomly toggle a device (employee action) every 10 seconds
    const simulationTimer = setInterval(() => {
      const currentDevices = devicesRef.current;
      const randomIndex = Math.floor(Math.random() * currentDevices.length);
      const device = currentDevices[randomIndex];
      
      const nextStatus = device.status === "on" ? "off" : "on";
      
      setDevices((prev) =>
        prev.map((d, idx) => {
          if (idx === randomIndex) {
            return {
              ...d,
              status: nextStatus,
              lastChanged: new Date().toISOString(),
            };
          }
          return d;
        })
      );

      // Occasional alert generator
      const now = new Date();
      const currentHour = now.getHours();
      
      if (nextStatus === "on" && (currentHour >= 17 || currentHour < 9)) {
        const alertId = `alert-afterhours-${Date.now()}`;
        const newAlert: Alert = {
          id: alertId,
          severity: "warning",
          message: `After-Hours Warning: ${device.room.toUpperCase()} ${device.label} was turned ON at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (outside office hours).`,
          room: device.room,
          timestamp: now.toISOString(),
        };
        setAlerts((prev) => [newAlert, ...prev]);
      }
    }, 10000);

    // Accumulate energy consumption and simulate occupancy changes
    let tickCount = 0;
    const energyAccumulationTimer = setInterval(() => {
      tickCount += 1;
      const currentDevices = devicesRef.current;
      
      // Randomly toggle room occupancy in simulator (every 6 seconds)
      if (tickCount % 6 === 0) {
        const roomsList = ["drawing", "work1", "work2"];
        const randomRoom = roomsList[Math.floor(Math.random() * roomsList.length)];
        setOccupancy((prev) => {
          const nextOccupancy = {
            ...prev,
            [randomRoom]: !prev[randomRoom],
          };
          
          // Trigger alert if room is vacant but has active devices
          const roomDevices = currentDevices.filter((d) => d.room === randomRoom);
          const activeDevices = roomDevices.filter((d) => d.status === "on");
          if (!nextOccupancy[randomRoom] && activeDevices.length > 0) {
            const devLabels = activeDevices.map((d) => d.label).join(", ");
            const alertId = `alert-vacant-${randomRoom}-${Date.now()}`;
            const alertMsg = `Empty Room Warning: ${randomRoom.toUpperCase()} is unoccupied, but [${devLabels}] are still running! Turn off room electricity.`;
            
            setAlerts((prevAlerts) => [
              {
                id: alertId,
                severity: "warning",
                message: alertMsg,
                room: randomRoom,
                timestamp: new Date().toISOString(),
              },
              ...prevAlerts,
            ]);
          }
          
          return nextOccupancy;
        });
      }

      let totalWatts = 0;
      currentDevices.forEach((d) => {
        if (d.status === "on") {
          totalWatts += d.wattage;
        }
      });

      const currentDraw = totalWatts > 0 ? totalWatts : 120;
      const incrementKwh = (currentDraw * 1) / (3600 * 1000);

      setTodayKwh((prev) => Number((prev + incrementKwh).toFixed(5)));

      // Rule check: Device fully on > 2h continuous
      const activeAlerts = alertsRef.current;
      const nowMs = Date.now();

      currentDevices.forEach((d) => {
        if (d.status === "on") {
          const lastChangedMs = new Date(d.lastChanged).getTime();
          const durationMs = nowMs - lastChangedMs;
          
          const TWO_HOURS_MS = 45000; // 45s in simulation
          const alertId = `alert-duration-${d.id}`;

          if (durationMs > TWO_HOURS_MS && !activeAlerts.some((a) => a.id === alertId)) {
            const alertMsg = `Critical Usage: ${d.room.toUpperCase()} ${d.label} has been running continuously for over 2 hours (${d.wattage}W).`;
            const newAlert: Alert = {
              id: alertId,
              severity: "critical",
              message: alertMsg,
              room: d.room,
              timestamp: new Date().toISOString(),
            };
            setAlerts((prevAlerts) => [newAlert, ...prevAlerts]);
          }
        }
      });
    }, 1000);

    return () => {
      clearInterval(simulationTimer);
      clearInterval(energyAccumulationTimer);
    };
  }, [connectionStatus]);

  return {
    devices,
    alerts,
    usage,
    occupancy,
    connectionStatus,
    toggleDevice,
    clearAlert,
  };
}
