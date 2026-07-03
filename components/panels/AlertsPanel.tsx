"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert } from "../../lib/api-client";
import { formatTime } from "../../lib/format";

type AlertsPanelProps = {
  alerts: Alert[];
  onClearAlert: (id: string) => void;
};

export default function AlertsPanel({ alerts, onClearAlert }: AlertsPanelProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Monitor prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, []);

  return (
    <div className="border-2 border-line rounded-lg bg-canvas p-5 flex flex-col h-full relative overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-line pb-2 mb-4">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
          // ACTIVE_ANOMALY_ALERTS
        </span>
        <span className="font-mono text-[9px] text-alert font-bold bg-alert/5 border border-alert/20 px-1.5 py-0.5 rounded">
          {alerts.length} ALERTS
        </span>
      </div>

      {/* Alerts Feed */}
      <div className="flex-1 overflow-y-auto max-h-[350px] scrollbar-thin scrollbar-thumb-line pr-1">
        <AnimatePresence initial={false}>
          {alerts.length === 0 ? (
            // Custom friendly empty state
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-32 text-center border border-dashed border-line/75 rounded bg-canvas/20"
            >
              <span className="text-xl mb-1.5 select-none opacity-85">🌱</span>
              <span className="font-sans font-bold text-xs text-ink uppercase tracking-wide">
                No alerts.
              </span>
              <span className="font-sans text-[10px] text-ink-muted">
                Everything's where it should be.
              </span>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-3">
              {alerts.map((alert) => {
                const isCritical = alert.severity === "critical";

                // Animation parameters based on user accessibility preferences
                const animationProps = prefersReducedMotion
                  ? {
                      initial: { opacity: 1, y: 0, borderLeftWidth: 4, borderColor: isCritical ? "var(--color-alert)" : "var(--color-power-on)" },
                      animate: { opacity: 1, y: 0 },
                      exit: { opacity: 0 },
                    }
                  : {
                      initial: {
                        opacity: 0,
                        y: -20,
                        borderLeftWidth: 12,
                        borderColor: isCritical ? "var(--color-alert)" : "var(--color-power-on)",
                      },
                      animate: {
                        opacity: 1,
                        y: 0,
                        borderColor: isCritical
                          ? ["var(--color-alert)", "#C4432A", "var(--color-alert)"]
                          : ["var(--color-power-on)", "#F0A63C", "var(--color-power-on)"],
                        borderLeftWidth: [12, 12, 4],
                      },
                      exit: { opacity: 0, x: 30 },
                    };

                return (
                  <motion.div
                    key={alert.id}
                    initial={animationProps.initial}
                    animate={animationProps.animate}
                    exit={animationProps.exit}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    style={{ borderLeftStyle: "solid" }}
                    className={`flex justify-between items-start p-3 rounded border bg-canvas/30 ${
                      isCritical
                        ? "border-alert/30 text-ink shadow-[0_2px_8px_-4px_rgba(196,67,42,0.15)]"
                        : "border-line text-ink shadow-[0_2px_8px_-4px_rgba(240,166,60,0.15)]"
                    }`}
                  >
                    {/* Left: Indicator, Message & Time */}
                    <div className="flex flex-col gap-1.5 flex-1 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[8.5px] font-mono font-extrabold px-1 rounded uppercase tracking-wide border ${
                            isCritical
                              ? "bg-alert/10 border-alert/30 text-alert"
                              : "bg-power-on/10 border-power-on/30 text-power-on"
                          }`}
                        >
                          {alert.severity}
                        </span>
                        
                        <span className="font-mono text-[9px] text-ink-muted">
                          {formatTime(alert.timestamp)}
                        </span>
                      </div>

                      <p className="font-sans text-[11px] leading-relaxed text-ink font-medium">
                        {alert.message}
                      </p>
                    </div>

                    {/* Right: Resolve Button */}
                    <button
                      onClick={() => onClearAlert(alert.id)}
                      className="font-mono text-[9px] text-ink-muted hover:text-ink hover:underline cursor-pointer select-none py-0.5 px-1.5 border border-transparent hover:border-line rounded transition-all duration-200"
                    >
                      ACK
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-line pt-2 mt-4 text-[9px] font-mono text-ink-muted flex justify-between select-none">
        <span>AUTO_CLEAR: OFF</span>
        <span>SYS_LOG: BUFFERED</span>
      </div>
    </div>
  );
}
