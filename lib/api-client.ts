export type Device = {
  id: string;            // "drawing-fan-1", "work1-light-3"
  type: "fan" | "light";
  room: "drawing" | "work1" | "work2";
  label: string;         // "Fan 1", "Light 3"
  status: "on" | "off";
  wattage: number;       // realistic draw when on (fan ~60W, light ~15W)
  lastChanged: string;   // ISO timestamp
};

export type Alert = {
  id: string;
  severity: "warning" | "critical";
  message: string;       // human-readable, pre-formatted by backend/LLM
  room?: string;
  timestamp: string;
};

export type UsageStats = {
  totalWattsNow: number;
  todayKwh: number;
  perRoom: Record<string, number>;
};

// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const SSE_STREAM_URL = `${API_BASE_URL}/api/stream`;
export const DEVICES_URL = `${API_BASE_URL}/api/devices`;
export const USAGE_URL = `${API_BASE_URL}/api/usage`;
export const ALERTS_URL = `${API_BASE_URL}/api/alerts`;
