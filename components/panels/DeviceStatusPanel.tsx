"use client";

import React, { useEffect, useState } from "react";
import { Device } from "../../lib/api-client";
import StatusDot from "../ui/StatusDot";
import RoomBadge from "../ui/RoomBadge";
import { formatWatts, formatRelativeTime } from "../../lib/format";

type DeviceStatusPanelProps = {
  devices: Device[];
  onToggleDevice: (id: string) => void;
};

export default function DeviceStatusPanel({ devices, onToggleDevice }: DeviceStatusPanelProps) {
  // We need to trigger an update for relative timestamps every few seconds
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const rooms = [
    { key: "drawing", name: "Drawing Room" },
    { key: "work1", name: "Work Room 1" },
    { key: "work2", name: "Work Room 2" },
  ] as const;

  return (
    <div className="border-2 border-line rounded-lg bg-canvas p-5 relative overflow-hidden flex flex-col gap-6">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
          // DEVICE_STATUS_REGISTRY
        </span>
        <span className="font-mono text-[9px] text-ink-muted">TOTAL_DEVS: 18</span>
      </div>

      {/* Grid of rooms (3 columns on desktop, 1 on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const roomDevices = devices.filter((d) => d.room === room.key);

          return (
            <div key={room.key} className="flex flex-col gap-4 border border-line/45 rounded bg-canvas/30 p-3">
              {/* Room Header Badge */}
              <RoomBadge name={room.name} className="py-1 border-b border-line/30" />

              {/* Devices List */}
              <div className="flex flex-col gap-2.5">
                {roomDevices.map((device) => {
                  const isOn = device.status === "on";
                  const tag = `${device.type === "fan" ? "F" : "L"}${device.label.split(" ").pop()}`;

                  return (
                    <div
                      key={device.id}
                      className={`flex items-center justify-between p-2 rounded border transition-all duration-300 ${
                        isOn
                          ? "bg-power-on/5 border-power-on/45"
                          : "bg-canvas border-line/70"
                      }`}
                    >
                      {/* Left: Indicator & Info */}
                      <div className="flex items-center gap-2.5">
                        <StatusDot status={isOn ? "on" : "off"} />
                        
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-sans font-bold text-xs text-ink">
                              {device.label}
                            </span>
                            <span className="font-mono text-[8.5px] bg-line/30 px-1 rounded font-bold text-ink-muted">
                              {tag}
                            </span>
                          </div>
                          
                          <span className="font-mono text-[8px] text-ink-muted mt-0.5">
                            {isOn ? formatWatts(device.wattage) : "0 W"} • {formatRelativeTime(device.lastChanged)}
                          </span>
                        </div>
                      </div>

                      {/* Right: Technical Toggle Button */}
                      <button
                        onClick={() => onToggleDevice(device.id)}
                        aria-pressed={isOn}
                        aria-label={`Toggle ${room.name} ${device.label}`}
                        className={`font-mono text-[9px] font-bold px-2.5 py-1 rounded border transition-all duration-300 uppercase cursor-pointer select-none ${
                          isOn
                            ? "bg-power-on border-power-on text-canvas shadow-[0_0_6px_var(--color-power-on)] hover:bg-power-on/90"
                            : "bg-canvas border-line text-ink-muted hover:border-ink hover:text-ink"
                        }`}
                      >
                        {device.status}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
