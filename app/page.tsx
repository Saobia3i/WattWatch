"use client";

import React, { useState } from "react";
import { useLiveOffice } from "../hooks/useLiveOffice";
import LiveClock from "../components/ui/LiveClock";
import OfficeBlueprint from "../components/blueprint/OfficeBlueprint";
import PowerMeterPanel from "../components/panels/PowerMeterPanel";
import AlertsPanel from "../components/panels/AlertsPanel";
import DeviceStatusPanel from "../components/panels/DeviceStatusPanel";
import StatusDot from "../components/ui/StatusDot";
import { formatWatts } from "../lib/format";

export default function Home() {
  const { devices, alerts, usage, occupancy, connectionStatus, toggleDevice, clearAlert } = useLiveOffice();
  const [expandedRoom, setExpandedRoom] = useState<string | null>("drawing");

  const rooms = [
    { key: "drawing", name: "Drawing Room" },
    { key: "work1", name: "Work Room 1" },
    { key: "work2", name: "Work Room 2" },
  ] as const;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-10 flex flex-col gap-6 select-none">
      {/* 1. Header Area */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-line pb-4">
        <div className="flex flex-col">
          <h1 className="font-display text-lg md:text-xl font-extrabold tracking-widest text-ink flex items-center gap-2">
            ⚡ WATTWATCH // ENERGY_MONITOR
          </h1>
          <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wider">
            Office Floor Plan Power Telemetry Console
          </p>
        </div>
        
        {/* Clock & Connection Badge */}
        <LiveClock connectionStatus={connectionStatus} />
      </header>

      {/* 2. Main Body Grid */}
      <main className="flex flex-col gap-6">
        
        {/* Row 1: Floor Plan Hero (Desktop) / Telemetry Breakdown (Split) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Hero Blueprint - Visible on Desktop, Hidden on Mobile */}
          <div className="hidden lg:block lg:col-span-8 h-full">
            <div className="flex flex-col gap-2 h-full">
              <span className="font-display text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                Interactive Floor Plan Blueprint
              </span>
              <OfficeBlueprint devices={devices} occupancy={occupancy} onToggleDevice={toggleDevice} />
            </div>
          </div>

          {/* Telemetry Panels - Side-by-side or stacked, stays above fold on mobile */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex-1 min-h-[220px]">
              <PowerMeterPanel usage={usage} />
            </div>
            
            <div className="flex-1 min-h-[200px]">
              <AlertsPanel alerts={alerts} onClearAlert={clearAlert} />
            </div>
          </div>
        </div>

        {/* Mobile Accordion Floor Plan - Collapses below the fold on mobile, hidden on desktop */}
        <div className="block lg:hidden border-2 border-line rounded-lg bg-canvas p-4 shadow-inner">
          <div className="flex justify-between items-center pb-2 mb-3 border-b border-line">
            <span className="font-display text-xs font-bold text-ink uppercase tracking-wider">
              {"// ROOM_ACCORDION_BLUEPRINT"}
            </span>
            <span className="font-mono text-[8px] text-accent-line">EXPANDABLE_MAP</span>
          </div>

          <div className="flex flex-col gap-2">
            {rooms.map((room) => {
              const isExpanded = expandedRoom === room.key;
              const roomDevices = devices.filter((d) => d.room === room.key);
              const roomActiveWatts = usage.perRoom[room.key] || 0;
              const activeCount = roomDevices.filter((d) => d.status === "on").length;

              return (
                <div key={room.key} className="border border-line rounded overflow-hidden">
                  {/* Accordion Header */}
                  <button
                    onClick={() => setExpandedRoom(isExpanded ? null : room.key)}
                    className="w-full flex items-center justify-between p-3 bg-canvas/30 hover:bg-line/10 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-xs uppercase tracking-wide text-ink">
                        {room.name}
                      </span>
                      <span className="font-mono text-[8px] bg-line/40 px-1 rounded text-ink-muted">
                        {activeCount} / {roomDevices.length} ON
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] font-bold text-ink">
                        {formatWatts(roomActiveWatts)}
                      </span>
                      <span className="text-[10px] text-ink-muted transition-transform duration-200">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="p-3 bg-canvas/10 border-t border-line/60 flex flex-col gap-3 transition-all duration-300">
                      {/* Technical Room Stats */}
                      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono border-b border-line/40 pb-2 mb-1">
                        <span className={occupancy[room.key] ? "text-power-on font-bold" : "text-ink-muted"}>
                          OCCUPANCY: {occupancy[room.key] ? "OCCUPIED" : "VACANT"}
                        </span>
                        <span className="text-right text-ink-muted">PEAK_CAPACITY: 165W</span>
                      </div>

                      {/* Device List for Room */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {roomDevices.map((device) => {
                          const isOn = device.status === "on";
                          const tag = `${device.type === "fan" ? "F" : "L"}${device.label.split(" ").pop()}`;

                          return (
                            <div
                              key={device.id}
                              className={`flex items-center justify-between p-2 rounded border text-xs transition-all duration-300 ${
                                isOn
                                  ? "bg-power-on/5 border-power-on/40 text-ink"
                                  : "bg-canvas border-line/60 text-ink-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <StatusDot status={isOn ? "on" : "off"} size="sm" />
                                <span className="font-sans font-bold">{device.label}</span>
                                <span className="font-mono text-[8px] bg-line/20 px-1 rounded">
                                  {tag}
                                </span>
                              </div>

                              <button
                                onClick={() => toggleDevice(device.id)}
                                className={`font-mono text-[8px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                  isOn
                                    ? "bg-power-on border-power-on text-canvas"
                                    : "bg-canvas border-line text-ink-muted"
                                }`}
                              >
                                {device.status.toUpperCase()}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Full Device Control Grid (Desktop) */}
        <div className="w-full">
          <DeviceStatusPanel devices={devices} onToggleDevice={toggleDevice} />
        </div>
      </main>
      
      {/* 3. Footer */}
      <footer className="mt-8 border-t border-line pt-4 text-[9px] font-mono text-ink-muted flex flex-col md:flex-row justify-between items-center gap-2">
        <span>© WATTWATCH INDUSTRIAL ENERGY NETWORKS CO.</span>
        <span className="tracking-widest uppercase">
          SECURE CONNECTION // PROTOCOL: SSE-OVER-HTTP
        </span>
      </footer>
    </div>
  );
}
