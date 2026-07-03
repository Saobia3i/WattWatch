"use client";

import React, { useState, useEffect } from "react";
import StatusDot from "./StatusDot";

type LiveClockProps = {
  connectionStatus: "connected" | "reconnecting" | "mock";
};

export default function LiveClock({ connectionStatus }: LiveClockProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      setTime(new Date());
    });
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return (
      <div className="flex items-center gap-4 text-xs font-mono text-ink-muted animate-pulse">
        <span>00:00:00 UTC</span>
        <span className="w-[1px] h-3 bg-line"></span>
        <span>LOADING...</span>
      </div>
    );
  }

  const hours = time.getHours();
  const isOfficeHours = hours >= 9 && hours < 17;

  const timeString = time.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const connectionDetails = {
    connected: {
      label: "LIVE SSE",
      dot: "on" as const,
      pulse: false,
      class: "text-power-on border-power-on/30 bg-power-on/5",
    },
    reconnecting: {
      label: "RECONNECTING",
      dot: "error" as const,
      pulse: true,
      class: "text-alert border-alert/30 bg-alert/5 animate-pulse",
    },
    mock: {
      label: "MOCK ACTIVE",
      dot: "on" as const,
      pulse: true,
      class: "text-accent-line border-accent-line/30 bg-accent-line/5",
    },
  }[connectionStatus];

  return (
    <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs font-mono select-none">
      {/* Live Time */}
      <span className="text-ink font-bold tracking-widest bg-line/20 px-2 py-0.5 rounded border border-line/40">
        {timeString}
      </span>

      <span className="w-[1px] h-3 bg-line hidden sm:inline-block"></span>

      {/* Office Hours Badge */}
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] tracking-wider uppercase font-semibold ${
          isOfficeHours
            ? "border-accent-line/30 text-accent-line bg-accent-line/5"
            : "border-ink-muted/30 text-ink-muted bg-ink-muted/5"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isOfficeHours ? "bg-accent-line" : "bg-ink-muted"
          }`}
        ></span>
        <span>{isOfficeHours ? "Office Hours (Open)" : "After Hours (Closed)"}</span>
      </div>

      <span className="w-[1px] h-3 bg-line hidden sm:inline-block"></span>

      {/* Connection Status Badge */}
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] tracking-wider uppercase font-semibold ${connectionDetails.class}`}
      >
        <StatusDot status={connectionDetails.dot} size="sm" pulse={connectionDetails.pulse} />
        <span>{connectionDetails.label}</span>
      </div>
    </div>
  );
}
