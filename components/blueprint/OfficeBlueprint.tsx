"use client";

import React from "react";
import DeviceMarker from "./DeviceMarker";
import { Device } from "../../lib/api-client";

type OfficeBlueprintProps = {
  devices: Device[];
  occupancy: Record<string, boolean>;
  onToggleDevice: (id: string) => void;
};

export default function OfficeBlueprint({ devices, occupancy, onToggleDevice }: OfficeBlueprintProps) {
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
        SYS.DWG // OFFICE_FLOORPLAN_V2.0
      </div>

      <div className="absolute top-2 right-4 text-[8px] font-mono text-accent-line tracking-widest uppercase opacity-70">
        SCALE: 1:50 // METRIC
      </div>

      <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-line">
        <svg
          viewBox="0 0 800 480"
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
          </defs>

          {/* 1. Background Grid */}
          <rect width="800" height="480" fill="url(#grid)" />

          {/* 2. Outer Layout Borders */}
          <rect x="10" y="10" width="780" height="460" className="fill-none stroke-line" strokeWidth="1" />
          <rect x="14" y="14" width="772" height="452" className="fill-none stroke-line/40" strokeWidth="0.5" />

          {/* 3. Rooms and Corridor Shading/Polygons */}
          {/* Drawing Room (Left) */}
          <rect x="30" y="30" width="240" height="320" className="fill-line/5" />
          {/* Work Room 1 (Middle) */}
          <rect x="270" y="30" width="250" height="320" className="fill-line/5" />
          {/* Work Room 2 (Right) */}
          <rect x="520" y="30" width="250" height="320" className="fill-line/5" />
          {/* Corridor (Bottom) */}
          <rect x="30" y="350" width="740" height="100" className="fill-line/5" />

          {/* 4. Windows (Double lines on outside walls) */}
          {/* Drawing Room Windows (Top & Left) */}
          <line x1="30" y1="100" x2="30" y2="180" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="28" y1="100" x2="28" y2="180" className="stroke-line" strokeWidth="1" />
          <line x1="32" y1="100" x2="32" y2="180" className="stroke-line" strokeWidth="1" />

          <line x1="110" y1="30" x2="170" y2="30" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="110" y1="28" x2="170" y2="28" className="stroke-line" strokeWidth="1" />
          <line x1="110" y1="32" x2="170" y2="32" className="stroke-line" strokeWidth="1" />

          {/* Work Room 1 Windows (Top) */}
          <line x1="350" y1="30" x2="410" y2="30" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="350" y1="28" x2="410" y2="28" className="stroke-line" strokeWidth="1" />
          <line x1="350" y1="32" x2="410" y2="32" className="stroke-line" strokeWidth="1" />

          {/* Work Room 2 Windows (Top & Right) */}
          <line x1="600" y1="30" x2="660" y2="30" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="600" y1="28" x2="660" y2="28" className="stroke-line" strokeWidth="1" />
          <line x1="600" y1="32" x2="660" y2="32" className="stroke-line" strokeWidth="1" />

          <line x1="770" y1="180" x2="770" y2="260" className="stroke-canvas-dark/40" strokeWidth="4" />
          <line x1="768" y1="180" x2="768" y2="260" className="stroke-line" strokeWidth="1" />
          <line x1="772" y1="180" x2="772" y2="260" className="stroke-line" strokeWidth="1" />

          {/* 5. Main Wall Structures (Double Line Architectural Style) */}
          <g className="stroke-line fill-none" strokeLinecap="square">
            {/* Outer perimeter walls */}
            <rect x="30" y="30" width="740" height="420" strokeWidth="4" />

            {/* Vertical dividing wall: Drawing Room / Work Room 1 */}
            <line x1="270" y1="30" x2="270" y2="350" strokeWidth="4" />

            {/* Vertical dividing wall: Work Room 1 / Work Room 2 */}
            <line x1="520" y1="30" x2="520" y2="350" strokeWidth="4" />

            {/* Horizontal wall separating rooms and bottom corridor */}
            {/* Door opening gap for Drawing: x=175 to 215 */}
            <line x1="30" y1="350" x2="175" y2="350" strokeWidth="4" />
            <line x1="215" y1="350" x2="275" y2="350" strokeWidth="4" />
            {/* Door opening gap for Work Room 1: x=275 to 315 */}
            <line x1="315" y1="350" x2="525" y2="350" strokeWidth="4" />
            {/* Door opening gap for Work Room 2: x=525 to 565 */}
            <line x1="565" y1="350" x2="770" y2="350" strokeWidth="4" />

            {/* Main Entrance corridor opening gap (bottom center): x=380 to 420 */}
            {/* We will break the bottom wall line by overriding it with door swing */}
          </g>

          {/* 6. Door Swings (Drawn as arcs swinging inward/outward) */}
          {/* Main Entry door (bottom center of corridor, swinging outward) */}
          <path d="M 420,450 A 40,40 0 0,1 380,490" className="stroke-line/60 fill-none" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="420" y1="450" x2="420" y2="490" className="stroke-line" strokeWidth="1.5" />
          {/* Overlay to mask the bottom wall at entry */}
          <line x1="380" y1="450" x2="420" y2="450" className="stroke-canvas" strokeWidth="5" />
          
          {/* Entry Arrow pointing up */}
          <path d="M 400,480 L 400,460 M 396,466 L 400,460 L 404,466" className="stroke-ink fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="400" y="493" textAnchor="middle" className="font-mono text-[9px] font-bold fill-ink tracking-wider">ENTRY</text>

          {/* Door into Drawing Room (swinging into room) */}
          <path d="M 215,350 A 40,40 0 0,0 175,310" className="stroke-line/60 fill-none" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="215" y1="350" x2="215" y2="310" className="stroke-line" strokeWidth="1.5" />
          <line x1="175" y1="350" x2="215" y2="350" className="stroke-canvas" strokeWidth="5" />

          {/* Door into Work Room 1 (swinging into room) */}
          <path d="M 275,350 A 40,40 0 0,1 315,310" className="stroke-line/60 fill-none" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="275" y1="350" x2="275" y2="310" className="stroke-line" strokeWidth="1.5" />
          <line x1="275" y1="350" x2="315" y2="350" className="stroke-canvas" strokeWidth="5" />

          {/* Door into Work Room 2 (swinging into room) */}
          <path d="M 525,350 A 40,40 0 0,1 565,310" className="stroke-line/60 fill-none" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="525" y1="350" x2="525" y2="310" className="stroke-line" strokeWidth="1.5" />
          <line x1="525" y1="350" x2="565" y2="350" className="stroke-canvas" strokeWidth="5" />

          {/* 7. Furniture Silhouettes & Plants (Blueprint Style) */}
          {/* Drawing Room Furniture */}
          {/* Sofa on the left wall */}
          <g className="stroke-line/60 fill-none" strokeWidth="1">
            <rect x="40" y="110" width="30" height="140" rx="3" />
            <rect x="40" y="120" width="8" height="120" />
            <line x1="40" y1="160" x2="70" y2="160" />
            <line x1="40" y1="200" x2="70" y2="200" />
          </g>
          {/* Armchair bottom-left */}
          <rect x="42" y="280" width="30" height="30" rx="3" className="stroke-line/60 fill-none" strokeWidth="1" />
          {/* Central Rug and Coffee Table */}
          <rect x="105" y="140" width="80" height="80" rx="2" className="stroke-line/30 fill-none" strokeWidth="1" strokeDasharray="3,3" />
          <rect x="120" y="155" width="50" height="50" rx="1" className="stroke-line/60 fill-none" strokeWidth="1" />
          {/* Plants */}
          <g className="stroke-accent-line/60 fill-none" strokeWidth="1">
            {/* Top Left plant */}
            <circle cx="50" cy="50" r="8" />
            <path d="M50,50 L42,42 M50,50 L58,42 M50,50 L42,58 M50,50 L58,58 M50,50 L50,38 M50,50 L50,62 M50,50 L38,50 M50,50 L62,50" />
            {/* Bottom Right plant */}
            <circle cx="250" cy="325" r="8" />
            <path d="M250,325 L242,317 M250,325 L258,317 M250,325 L242,333 M250,325 L258,333 M250,325 L250,313 M250,325 L250,337 M250,325 L238,325 M250,325 L262,325" />
          </g>

          {/* Work Room 1 Desks & Chairs */}
          <g className="stroke-line/60 fill-none" strokeWidth="1">
            {/* Top desks (left & right) */}
            <rect x="290" y="110" width="40" height="24" rx="1" />
            <circle cx="310" cy="144" r="5" />
            <rect x="460" y="110" width="40" height="24" rx="1" />
            <circle cx="480" cy="144" r="5" />
            {/* Bottom desks (left & right) */}
            <rect x="290" y="206" width="40" height="24" rx="1" />
            <circle cx="310" cy="196" r="5" />
            <rect x="460" y="206" width="40" height="24" rx="1" />
            <circle cx="480" cy="196" r="5" />
          </g>

          {/* Work Room 2 Desks & Chairs */}
          <g className="stroke-line/60 fill-none" strokeWidth="1">
            {/* Top desks (left & right) */}
            <rect x="540" y="110" width="40" height="24" rx="1" />
            <circle cx="560" cy="144" r="5" />
            <rect x="710" y="110" width="40" height="24" rx="1" />
            <circle cx="730" cy="144" r="5" />
            {/* Bottom desks (left & right) */}
            <rect x="540" y="206" width="40" height="24" rx="1" />
            <circle cx="560" cy="196" r="5" />
            <rect x="710" y="206" width="40" height="24" rx="1" />
            <circle cx="730" cy="196" r="5" />
          </g>

          {/* Corridor Furniture & Plants */}
          <g className="stroke-accent-line/60 fill-none" strokeWidth="1">
            {/* Left Corridor Plant */}
            <circle cx="55" cy="405" r="9" />
            <path d="M55,405 L47,397 M55,405 L63,397 M55,405 L47,413 M55,405 L63,413 M55,405 L55,393 M55,405 L55,417" />
            {/* Right Corridor Plant */}
            <circle cx="675" cy="405" r="9" />
            <path d="M675,405 L667,397 M675,405 L683,397 M675,405 L667,413 M675,405 L683,413 M675,405 L675,393 M675,405 L675,417" />
          </g>
          {/* Water dispenser dispenser silhouette */}
          <g className="stroke-line/65 fill-none" strokeWidth="1">
            <rect x="735" y="390" width="22" height="22" rx="1" />
            <circle cx="746" cy="401" r="7" />
            <line x1="735" y1="404" x2="757" y2="404" />
          </g>

          {/* 8. Room Annotations */}
          {/* Drawing Room Label */}
          <text
            x="150"
            y="170"
            textAnchor="middle"
            className="font-display text-[9px] font-bold tracking-[0.2em] fill-ink uppercase"
          >
            — DRAWING ROOM —
          </text>
          <text x="150" y="182" textAnchor="middle" className="font-mono text-[7px] fill-ink-muted tracking-wider">
            WAITING AREA
          </text>
          {occupancy.drawing ? (
            <text x="150" y="195" textAnchor="middle" className="font-mono text-[7px] font-bold fill-power-on tracking-wider">
              ● OCCUPIED
            </text>
          ) : (
            <text x="150" y="195" textAnchor="middle" className="font-mono text-[7px] fill-ink-muted/80 tracking-wider">
              ○ VACANT
            </text>
          )}

          {/* Work Room 1 Label */}
          <text
            x="395"
            y="170"
            textAnchor="middle"
            className="font-display text-[9px] font-bold tracking-[0.2em] fill-ink uppercase"
          >
            — WORK ROOM 1 —
          </text>
          <text x="395" y="182" textAnchor="middle" className="font-mono text-[7px] fill-ink-muted tracking-wider">
            EMPLOYEES
          </text>
          {occupancy.work1 ? (
            <text x="395" y="195" textAnchor="middle" className="font-mono text-[7px] font-bold fill-power-on tracking-wider">
              ● OCCUPIED
            </text>
          ) : (
            <text x="395" y="195" textAnchor="middle" className="font-mono text-[7px] fill-ink-muted/80 tracking-wider">
              ○ VACANT
            </text>
          )}

          {/* Work Room 2 Label */}
          <text
            x="645"
            y="170"
            textAnchor="middle"
            className="font-display text-[9px] font-bold tracking-[0.2em] fill-ink uppercase"
          >
            — WORK ROOM 2 —
          </text>
          <text x="645" y="182" textAnchor="middle" className="font-mono text-[7px] fill-ink-muted tracking-wider">
            EMPLOYEES
          </text>
          {occupancy.work2 ? (
            <text x="645" y="195" textAnchor="middle" className="font-mono text-[7px] font-bold fill-power-on tracking-wider">
              ● OCCUPIED
            </text>
          ) : (
            <text x="645" y="195" textAnchor="middle" className="font-mono text-[7px] fill-ink-muted/80 tracking-wider">
              ○ VACANT
            </text>
          )}

          {/* 9. Interactive Devices (15 total: 6 fans, 9 lights - matching visual spec) */}
          {/* --- DRAWING ROOM DEVICES (2 Fans, 3 Lights) --- */}
          <DeviceMarker device={getDevice("drawing-fan-1")} x={150} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-fan-2")} x={150} y={240} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-light-1")} x={90} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-light-2")} x={210} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("drawing-light-3")} x={150} y={300} onToggle={onToggleDevice} />

          {/* --- WORK ROOM 1 DEVICES (2 Fans, 3 Lights) --- */}
          <DeviceMarker device={getDevice("work1-fan-1")} x={395} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-fan-2")} x={395} y={220} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-light-1")} x={330} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-light-2")} x={460} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work1-light-3")} x={395} y={300} onToggle={onToggleDevice} />

          {/* --- WORK ROOM 2 DEVICES (2 Fans, 3 Lights) --- */}
          <DeviceMarker device={getDevice("work2-fan-1")} x={645} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-fan-2")} x={645} y={220} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-light-1")} x={580} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-light-2")} x={710} y={100} onToggle={onToggleDevice} />
          <DeviceMarker device={getDevice("work2-light-3")} x={645} y={300} onToggle={onToggleDevice} />
        </svg>
      </div>
    </div>
  );
}
