"use client";

import React, { useState, useEffect } from "react";
import { UsageStats } from "../../lib/api-client";

type PowerMeterPanelProps = {
  usage: UsageStats;
};

// Custom hook to animate numeric values smoothly with support for prefers-reduced-motion
function useAnimatedNumber(target: number, duration: number = 400, precision: number = 0) {
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    // SSR check
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      requestAnimationFrame(() => {
        setCurrent(target);
      });
      return;
    }

    const start = current;
    const end = target;
    if (start === end) return;

    let startTime: number | null = null;
    let frameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeOutQuad
      const ease = progress * (2 - progress);
      const val = start + (end - start) * ease;
      
      setCurrent(Number(val.toFixed(precision)));

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, precision]);

  return current;
}

export default function PowerMeterPanel({ usage }: PowerMeterPanelProps) {
  const animatedWatts = useAnimatedNumber(usage.totalWattsNow, 350, 0);
  const animatedKwh = useAnimatedNumber(usage.todayKwh, 350, 2);

  // Maximum scale for the room load bars (total max could be 2 fans + 3 lights = 165W per room)
  const MAX_ROOM_WATTS = 165;

  return (
    <div className="border-2 border-line rounded-lg bg-canvas p-5 flex flex-col justify-between h-full relative overflow-hidden">
      {/* Blueprint Grid Watermark */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-line)_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col gap-6">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-line pb-2">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            {"// TELEMETRY_MATRIX"}
          </span>
          <span className="font-mono text-[9px] text-ink-muted">SYS_ACTIVE</span>
        </div>

        {/* Live Power Counters */}
        <div className="grid grid-cols-2 gap-4">
          {/* Active Demand */}
          <div className="border border-line bg-canvas/40 p-3 rounded">
            <span className="block text-[10px] font-sans font-bold text-ink-muted uppercase tracking-wider mb-1">
              Active Load
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-bold tracking-tight text-ink">
                {animatedWatts}
              </span>
              <span className="font-mono text-sm text-ink-muted">W</span>
            </div>
            <span className="block text-[8px] font-mono text-ink-muted/80 mt-1">
              DEMAND NOW
            </span>
          </div>

          {/* Today's Energy */}
          <div className="border border-line bg-canvas/40 p-3 rounded">
            <span className="block text-[10px] font-sans font-bold text-ink-muted uppercase tracking-wider mb-1">
              Energy Today
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-bold tracking-tight text-power-on">
                {animatedKwh.toFixed(2)}
              </span>
              <span className="font-mono text-sm text-power-on/80">kWh</span>
            </div>
            <span className="block text-[8px] font-mono text-ink-muted/80 mt-1">
              ESTIMATED CUMULATIVE
            </span>
          </div>
        </div>

        {/* Per-Room Power Breakdown */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-sans font-bold text-ink-muted uppercase tracking-wider">
            Room Demand Profiles
          </span>
          
          <div className="space-y-3">
            {Object.entries(usage.perRoom).map(([roomKey, watts]) => {
              const animatedRoomWatts = watts; // simplified animated room load or instant
              const percentage = Math.min((watts / MAX_ROOM_WATTS) * 100, 100);
              const roomNames = {
                drawing: "Drawing Room",
                work1: "Work Room 1",
                work2: "Work Room 2",
              };

              return (
                <div key={roomKey} className="space-y-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-sans font-medium text-ink uppercase tracking-wide text-[11px]">
                      {roomNames[roomKey as keyof typeof roomNames]}
                    </span>
                    <span className="font-mono font-semibold text-ink text-[11px]">
                      {animatedRoomWatts} W
                    </span>
                  </div>
                  
                  {/* Gauge Bar */}
                  <div className="h-2.5 w-full bg-line/30 rounded-sm overflow-hidden border border-line/50 relative">
                    <div
                      className="h-full bg-power-off transition-all duration-500 ease-out"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: watts > 0 ? "var(--color-power-on)" : "var(--color-power-off)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Carbon Offset or Technical Footer */}
      <div className="relative z-10 border-t border-line pt-2 mt-4 text-[9px] font-mono text-ink-muted flex justify-between">
        <span>UNIT: KILOWATT_HOUR</span>
        <span>PEAK_CAP: 495W</span>
      </div>
    </div>
  );
}
