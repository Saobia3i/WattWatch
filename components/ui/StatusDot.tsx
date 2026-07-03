"use client";

import React from "react";

type StatusDotProps = {
  status: "on" | "off" | "error";
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
};

export default function StatusDot({ status, size = "md", pulse = false }: StatusDotProps) {
  const sizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2.5 h-2.5",
    lg: "w-4 h-4",
  };

  const colorClasses = {
    on: "bg-power-on shadow-[0_0_8px_var(--color-power-on)]",
    off: "bg-power-off opacity-80",
    error: "bg-alert shadow-[0_0_8px_var(--color-alert)]",
  };

  return (
    <span className="relative flex items-center justify-center">
      {pulse && status !== "off" && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
            status === "on" ? "bg-power-on" : "bg-alert"
          }`}
        />
      )}
      <span
        className={`relative inline-block rounded-full transition-all duration-300 ${sizeClasses[size]} ${colorClasses[status]}`}
      />
    </span>
  );
}
