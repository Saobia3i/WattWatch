"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Device } from "../../lib/api-client";

type DeviceMarkerProps = {
  device: Device;
  x: number;
  y: number;
  onToggle: (id: string) => void;
};

export default function DeviceMarker({ device, x, y, onToggle }: DeviceMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const { id, type, label, status, wattage } = device;
  const isOn = status === "on";

  // Handle keydown for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(id);
    }
  };

  // Get symbol/label to display inside the marker circle
  const markerLabel = `${type === "fan" ? "F" : "L"}${label.split(" ").pop()}`;

  // Tooltip details
  const showTooltip = isHovered || isFocused;

  return (
    <g
      className="cursor-pointer select-none group"
      transform={`translate(${x}, ${y})`}
      onClick={() => onToggle(id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Outer Glow Ring for ON State */}
      {isOn && (
        <motion.circle
          cx={0}
          cy={0}
          r={22}
          className="fill-power-on/15 stroke-power-on/30 stroke-dasharray-[2,2]"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />
      )}

      {/* Focus Indicator Ring */}
      <circle
        cx={0}
        cy={0}
        r={26}
        className={`fill-none stroke-2 transition-all duration-200 ${
          isFocused ? "stroke-accent-line opacity-100" : "stroke-transparent opacity-0"
        }`}
      />

      {/* Main Interactive Button Node */}
      <circle
        cx={0}
        cy={0}
        r={16}
        className={`stroke-2 transition-colors duration-300 ${
          isOn
            ? "fill-canvas stroke-power-on shadow-[0_0_10px_var(--color-power-on)]"
            : "fill-canvas stroke-power-off"
        }`}
        tabIndex={0}
        role="button"
        aria-label={`${device.room} ${label}: ${status}, drawing ${wattage} watts`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
      />

      {/* Inner Icon Graphic */}
      <g transform="translate(0, 0)">
        {type === "fan" ? (
          // Fan Propeller Graphic
          <motion.g
            animate={isOn ? { rotate: 360 } : { rotate: 0 }}
            transition={
              isOn
                ? { repeat: Infinity, duration: 1.5, ease: "linear" }
                : { duration: 0.8, ease: "easeOut" }
            }
          >
            {/* 3 blades */}
            <path d="M0,0 Q-4,-12 0,-14 Q4,-12 0,0" className={isOn ? "fill-power-on" : "fill-power-off"} />
            <path d="M0,0 Q12,-4 14,0 Q12,4 0,0" className={isOn ? "fill-power-on" : "fill-power-off"} />
            <path d="M0,0 Q-8,8 -10,10 Q-12,6 0,0" className={isOn ? "fill-power-on" : "fill-power-off"} />
            <circle cx={0} cy={0} r={2} className="fill-canvas" />
          </motion.g>
        ) : (
          // Light Bulb Graphic
          <g transform="translate(0, -1)">
            <path
              d="M-5,-3 C-5,-7 5,-7 5,-3 C5,-1 3,1 2,3 L-2,3 C-3,1 -5,-1 -5,-3 Z"
              className={isOn ? "fill-power-on/20 stroke-power-on" : "fill-none stroke-power-off"}
              strokeWidth={1.5}
            />
            <line x1={-2} y1={5} x2={2} y2={5} className={isOn ? "stroke-power-on" : "stroke-power-off"} strokeWidth={1.5} />
            <line x1={-1} y1={7} x2={1} y2={7} className={isOn ? "stroke-power-on" : "stroke-power-off"} strokeWidth={1.5} />
            {isOn && (
              // Rays
              <g className="stroke-power-on" strokeWidth={1} strokeLinecap="round">
                <line x1={0} y1={-8} x2={0} y2={-11} />
                <line x1={-7} y1={-6} x2={-9} y2={-8} />
                <line x1={7} y1={-6} x2={9} y2={-8} />
                <line x1={-8} y1={-2} x2={-11} y2={-2} />
                <line x1={8} y1={-2} x2={11} y2={-2} />
              </g>
            )}
          </g>
        )}
      </g>

      {/* Label Text Tag (e.g. F1, L3) below marker */}
      <text
        x={0}
        y={type === "fan" ? 23 : 23}
        textAnchor="middle"
        className="font-mono text-[9px] font-bold tracking-wider fill-ink select-none pointer-events-none"
      >
        {markerLabel}
      </text>

      {/* Floating Blueprint Tooltip (HTML-inspired SVG representation) */}
      {showTooltip && (
        <g transform="translate(0, -36)" className="pointer-events-none">
          {/* Tooltip Background */}
          <rect
            x={-60}
            y={-24}
            width={120}
            height={46}
            rx={4}
            className="fill-canvas stroke-line stroke-2 shadow-lg"
          />
          {/* Small Arrow */}
          <polygon points="-6,22 6,22 0,28" className="fill-canvas stroke-line stroke-2" />
          <rect x={-5} y={20} width={10} height={3} className="fill-canvas" />

          {/* Text labels */}
          <text x={0} y={-10} textAnchor="middle" className="font-sans font-bold text-[10px] fill-ink">
            {label.toUpperCase()}
          </text>
          <text x={0} y={4} textAnchor="middle" className="font-mono text-[9px] fill-ink-muted">
            {status.toUpperCase()} • {isOn ? `${wattage}W` : "0W"}
          </text>
          <text x={0} y={15} textAnchor="middle" className="font-mono text-[7px] fill-ink-muted/80">
            CLICK TO TOGGLE
          </text>
        </g>
      )}
    </g>
  );
}
