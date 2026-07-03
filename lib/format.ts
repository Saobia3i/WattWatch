/**
 * Technical Watt/kWh and Timestamp formatters for the dashboard
 */

export function formatWatts(watts: number): string {
  return `${watts} W`;
}

export function formatKwh(kwh: number): string {
  return `${kwh.toFixed(2)} kWh`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "--:--:--";
  
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  if (diffMs < 0 || isNaN(diffMs)) return "just now";
  
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}
