"use client";

import React from "react";
import DeviceMarker from "./DeviceMarker";
import { Device } from "../../lib/api-client";

type OfficeBlueprintProps = {
  devices: Device[];
  onToggleDevice: (id: string) => void;
};

export default function OfficeBlueprint({ devices, onToggleDevice }: OfficeBlueprintProps) {
  // Find device status helper
  const getDevice = (id: string) => {
    return devices.find((d) => d.id === id) || {
      id,
      type: "light" as const,
      room: "drawing" as const,
      label: "Unknown",
      status: "off" as const,
      wattage: 0,
      lastChanged: new Date().toISOString(),
    };
  };

  return (
    <div className="relative w-full overflow-hidden border-2 border-line rounded-lg bg-canvas p-4 shadow-inner">
      {/* Aesthetic blueprint header in blueprint green */}
      <div className="absolute top-2 left-4 text-[8px] font-mono text-accent-line tracking-widest uppercase opacity-70">
        SYS.DWG // OFFICE_FLOORPLAN_V1.0
      </div>

      <div className="absolute top-2 right-4 text-[8px] font-mono text-accent-line tracking-widest uppercase opacity-70">
        SCALE: 1:50 // METRIC
      </div>

      <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-line">
        <svg
          viewBox="0 0 800 400"
          className="min-w-[760px] w-full h-auto text-ink"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" className="fill-line/50" />
              <line x1="0" y1="0" x2="0" y2="40" className="stroke-line/10" strokeWidth="0.5" />
              <line x1="0" y1="0" x2="40" y2="0" className="stroke-line/10" strokeWidth="0.5" />
            </pattern>

            {/* Hatch Pattern for Walls */}
            <pattern id="wall-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" className="stroke-line/30" strokeWidth="1" />
            </pattern>
          </defs>

          {/* 1. Background Grid */}
          <rect width="800" height="400" fill="url(#grid)" />

          {/* 2. Outer Layout Borders */}
          <rect x="10" y="10" width="780" height="380" className="fill-none stroke-line" strokeWidth="1" />
          <rect x="14" y="14" width="772" height="372" className="fill-none stroke-line/40" strokeWidth="0.5" />

          {/* 3. Rooms Shading/Polygons */}
          {/* Drawing Room Shading */}
          <rect x="30" y="30" width="230" height="340" className="fill-line/5" />
          {/* Work Room 1 Shading */}
          <rect x="280" y="30" width="490" height="160" className="fill-line/5" />
          {/* Work Room 2 Shading */}
          <rect x="280" y="210" width="490" height="160" className="fill-line/5" />

          {/* 4. Windows (Double lines on outside walls) */}
          {/* Left Wall Window */}
          <line x1="30" y1="120" x2="30" y2="280" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="28" y1="120" x2="28" y2="280" className="stroke-line" strokeWidth="1" />
          <line x1="32" y1="120" x2="32" y2="280" className="stroke-line" strokeWidth="1" />

          {/* Top Wall Windows */}
          <line x1="100" y1="30" x2="190" y2="30" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="100" y1="28" x2="190" y2="28" className="stroke-line" strokeWidth="1" />
          <line x1="100" y1="32" x2="190" y2="32" className="stroke-line" strokeWidth="1" />

          <line x1="450" y1="30" x2="600" y2="30" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="450" y1="28" x2="600" y2="28" className="stroke-line" strokeWidth="1" />
          <line x1="450" y1="32" x2="600" y2="32" className="stroke-line" strokeWidth="1" />

          {/* Bottom Wall Windows */}
          <line x1="450" y1="370" x2="600" y2="370" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="450" y1="368" x2="600" y2="368" className="stroke-line" strokeWidth="1" />
          <line x1="450" y1="372" x2="600" y2="372" className="stroke-line" strokeWidth="1" />

          {/* 5. Main Wall Structures (Double Line Architectural Style) */}
          <g className="stroke-line fill-none" strokeLinecap="square">
            {/* Outer perimeter walls */}
            <rect x="30" y="30" width="740" height="340" strokeWidth="4" />

            {/* Internal Dividing Walls */}
            {/* Main corridor divider wall between Drawing Room and Work Rooms */}
            <line x1="270" y1="30" x2="270" y2="150" strokeWidth="4" />
            {/* Door opening gap between Drawing and Work 1: y=150 to y=190 */}
            <line x1="270" y1="190" x2="270" y2="210" strokeWidth="4" />
            {/* Door opening gap between Drawing and Work 2: y=210 to y=250 */}
            <line x1="270" y1="250" x2="270" y2="370" strokeWidth="4" />

            {/* Horizontal dividing wall between Work Room 1 and Work Room 2 */}
            <line x1="270" y1="200" x2="770" y2="200" strokeWidth="4" />
          </g>

          {/* 6. Door Swings (Drawn as arcs) */}
          {/* Main Entrance door (bottom of drawing room) */}
          <path d="M 120,370 A 40,40 0 0,1 80,330" className="stroke-line/60 fill-none" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="120" y1="370" x2="120" y2="330" className="stroke-line" strokeWidth="1.5" />

          {/* Door into Work Room 1 */}
          <path d="M 270,190 A 40,40 0 0,0 310,150" className="stroke-line/60 fill-none" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="270" y1="190" x2="310" y2="190" className="stroke-line" strokeWidth="1.5" />

          {/* Door into Work Room 2 */}
          <path d="M 270,210 A 40,40 0 0,1 310,250" className="stroke-line/60 fill-none" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="270" y1="210" x2="310" y2="210" className="stroke-line" strokeWidth="1.5" />

          {/* 7. Room Annotations with Hairline Leader Lines */}
          {/* Drawing Room Label */}
          <line x1="145" y1="230" x2="145" y2="260" className="stroke-accent-line/30" strokeWidth="0.75" />
          <circle cx="145" cy="230" r="1.5" className="fill-accent-line/50" />
          <text
            x="145"
            y="275"
            textAnchor="middle"
            className="font-display text-[10px] font-bold tracking-[0.25em] fill-ink uppercase"
          >
            — DRAWING ROOM —
          </text>
          <text x="145" y="287" textAnchor="middle" className="font-mono text-[7.5px] fill-ink-muted tracking-wider">
            CAP: 10p • 120W BASE
          </text>

          {/* Work Room 1 Label */}
          <line x1="535" y1="150" x2="535" y2="162" className="stroke-accent-line/30" strokeWidth="0.75" />
          <circle cx="535" cy="150" r="1.5" className="fill-accent-line/50" />
          <text
            x="535"
            y="176"
            textAnchor="middle"
            className="font-display text-[10px] font-bold tracking-[0.25em] fill-ink uppercase"
          >
            — WORK ROOM 1 —
          </text>
          <text x="535" y="188" textAnchor="middle" className="font-mono text-[7.5px] fill-ink-muted tracking-wider">
            CAP: 15p • 120W BASE
          </text>

          {/* Work Room 2 Label */}
          <line x1="535" y1="240" x2="535" y2="252" className="stroke-accent-line/30" strokeWidth="0.75" />
          <circle cx="535" cy="240" r="1.5" className="fill-accent-line/50" />
          <text
            x="535"
            y="233"
            textAnchor="middle"
            className="font-display text-[10px] font-bold tracking-[0.25em] fill-ink uppercase"
          >
            — WORK ROOM 2 —
          </text>
          <text x="535" y="221" textAnchor="middle" className="font-mono text-[7.5px] fill-ink-muted tracking-wider">
            CAP: 15p • 120W BASE
          </text>

          {/* 8. North Arrow & Technical Symbolism */}
          <g transform="translate(745, 340)" className="opacity-60">
            <circle cx="0" cy="0" r="18" className="fill-none stroke-line" strokeWidth="1" />
            <line x1="0" y1="-22" x2="0" y2="22" className="stroke-line" strokeWidth="0.5" />
            <line x1="-22" y1="0" x2="22" y2="0" className="stroke-line" strokeWidth="0.5" />
            <polygon points="0,-18 -4,-2 0,-5 4,-2" className="fill-accent-line stroke-none" />
            <text x="0" y="-25" textAnchor="middle" className="font-mono text-[7px] font-bold fill-ink">N</text>
          </g>

          {/* 9. Interactive Devices (18 total: 6 fans, 12 lights) */}
          {/* --- DRAWING ROOM DEVICES --- */}
          <DeviceMarker device={getDevice("drawing-fan-1")} x={95} y={150} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-fan-2")} x={195} y={150} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-light-1")} x={85} y={80} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-light-2")} x={205} y={80} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-light-3")} x={85} y={320} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-light-4")} x={205} y={320} onToggle={onToggleDevice} />

          {/* --- WORK ROOM 1 DEVICES --- */}
          <DeviceMarker device={getDevice("work1-fan-1")} x={415} y={115} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-fan-2")} x={655} y={115} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-light-1")} x={345} y={70} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-light-2")} x={485} y={70} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-light-3")} x={585} y={70} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-light-4")} x={725} y={70} onToggle={onToggleDevice} />

          {/* --- WORK ROOM 2 DEVICES --- */}
          <DeviceMarker device={getDevice("work2-fan-1")} x={415} y={285} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-fan-2")} x={655} y={285} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-light-1")} x={345} y={330} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-light-2")} x={485} y={330} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-light-3")} x={585} y={330} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-light-4")} x={725} y={330} onToggle={onToggleDevice} />
        </svg>
      </div>
    </div>
  );
}
