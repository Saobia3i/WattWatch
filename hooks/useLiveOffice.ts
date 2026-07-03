"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Device, Alert, UsageStats, SSE_STREAM_URL } from "../lib/api-client";

// Helper to initialize 15 devices (2 fans, 3 lights per room * 3 rooms = 15 devices)
// This matches the official visual floor plan.
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
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
  }
];

export function useLiveOffice() {
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [todayKwh, setTodayKwh] = useState(4.85); // start with a realistic daily baseline
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

  // Derive power calculations directly from devices state (prevents cascading state updates)
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

  // Toggle a device state manually (either via click on blueprint or panel)
  const toggleDevice = useCallback((id: string) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const nextStatus = d.status === "on" ? "off" : "on";
          return {
            ...d,
            status: nextStatus,
            lastChanged: new Date().toISOString(),
          };
        }
        return d;
      })
    );
  }, []);

  // Clear an alert
  const clearAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // SSE Subscription & Reconnection logic + Simulator Fallback
  useEffect(() => {
    let sse: EventSource | null = null;
    let fallbackTimer: NodeJS.Timeout;
    let simulationTimer: NodeJS.Timeout;
    let energyAccumulationTimer: NodeJS.Timeout;

    // 1. Establish SSE Connection
    const connectSSE = () => {
      try {
        setConnectionStatus("reconnecting");
        sse = new EventSource(SSE_STREAM_URL);

        sse.onopen = () => {
          console.log("SSE Connection established successfully.");
          setConnectionStatus("connected");
          clearTimeout(fallbackTimer);
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
            }
          } catch (e) {
            console.error("Error parsing SSE event data:", e);
          }
        };

        sse.onerror = (err) => {
          console.warn("SSE connection error. Retrying...", err);
          setConnectionStatus("reconnecting");
          // If we fail and don't recover in 4 seconds, activate Simulator mode
          clearTimeout(fallbackTimer);
          fallbackTimer = setTimeout(() => {
            if (connectionStatus !== "connected") {
              console.log("SSE unavailable. Activating local simulator fallback.");
              setConnectionStatus("mock");
              if (sse) {
                sse.close();
                sse = null;
              }
            }
          }, 4000);
        };
      } catch (err) {
        console.error("Failed to connect to SSE:", err);
        setConnectionStatus("mock");
      }
    };

    // Attempt connection
    connectSSE();

    // 2. Local Simulator Logic (Active only when connectionStatus === 'mock')
    // Simulates dynamic office behavior, background load, occupancy, alerts
    const runSimulation = () => {
      if (connectionStatus !== "mock") return;

      // Randomly toggle a device (employee action) every 10 seconds
      simulationTimer = setInterval(() => {
        const currentDevices = devicesRef.current;
        const randomIndex = Math.floor(Math.random() * currentDevices.length);
        const device = currentDevices[randomIndex];
        
        // Let's toggle the device
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

        console.log(`[Simulator] Employee toggled ${device.room} ${device.label} ${nextStatus.toUpperCase()}`);

        // Occasional alert generator
        // e.g. If device is fan and was toggled on after 5 PM
        const now = new Date();
        const currentHour = now.getHours();
        
        if (nextStatus === "on" && (currentHour >= 17 || currentHour < 9)) {
          // Trigger after hours alert
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

      // Accumulate energy consumption: add watt-seconds to kWh total
      // kWh = (Watts * seconds) / (3600 * 1000)
      energyAccumulationTimer = setInterval(() => {
        const currentDevices = devicesRef.current;
        let totalWatts = 0;
        currentDevices.forEach((d) => {
          if (d.status === "on") {
            totalWatts += d.wattage;
          }
        });

        // add a tiny background office load (servers, routers) if total watts is 0
        const currentDraw = totalWatts > 0 ? totalWatts : 120; // 120W ambient draw
        const incrementKwh = (currentDraw * 1) / (3600 * 1000);

        setTodayKwh((prev) => Number((prev + incrementKwh).toFixed(5)));

        // Rule check: Device fully on > 2h continuous
        const activeAlerts = alertsRef.current;
        const nowMs = Date.now();

        currentDevices.forEach((d) => {
          if (d.status === "on") {
            const lastChangedMs = new Date(d.lastChanged).getTime();
            const durationMs = nowMs - lastChangedMs;
            
            // For testing, let's say 45 seconds of continuous run simulates "> 2 hours" in mock mode
            const TWO_HOURS_MS = 45000; 
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
              setAlerts((prev) => [newAlert, ...prev]);
            }
          }
        });
      }, 1000);
    };

    // Run simulation if mock mode is active
    if (connectionStatus === "mock") {
      runSimulation();
    }

    return () => {
      if (sse) sse.close();
      clearTimeout(fallbackTimer);
      clearInterval(simulationTimer);
      clearInterval(energyAccumulationTimer);
    };
  }, [connectionStatus]);

  return {
    devices,
    alerts,
    usage,
    connectionStatus,
    toggleDevice,
    clearAlert,
  };
}
