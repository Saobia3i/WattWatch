"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Occupant = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

const FALLBACK_OCCUPANTS: Occupant[] = [
  {
    id: "nafisa",
    name: "Nafisa Rahman",
    email: "nafisa.rahman@yahoo.com",
    phone: "+8801812345678",
  },
  {
    id: "tanvir",
    name: "Tanvir Hossain",
    email: "tanvir.hossain@yahoo.com",
    phone: "+8801912345678",
  },
];

export default function DirectoryPanel() {
  const [occupants, setOccupants] = useState<Occupant[]>(FALLBACK_OCCUPANTS);

  useEffect(() => {
    fetch("/api/occupants")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setOccupants(data);
        }
      })
      .catch((e) => {
        console.error("Error fetching occupants:", e);
        setOccupants(FALLBACK_OCCUPANTS);
      });
  }, []);

  return (
    <div className="border-2 border-line rounded-lg bg-canvas p-5 flex flex-col h-full relative overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-line pb-2 mb-4">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
          {"// OFFICE_DIRECTORY"}
        </span>
        <span className="font-mono text-[9px] text-accent-line font-bold bg-line/40 px-1.5 py-0.5 rounded">
          {occupants.length} MEMBERS
        </span>
      </div>

      {/* Directory List */}
      <div className="flex-1 overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-line pr-1">
        {occupants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-center border border-dashed border-line/75 rounded bg-canvas/20">
            <span className="font-sans font-bold text-xs text-ink uppercase tracking-wide">
              No occupants listed.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {occupants.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start justify-between p-3 rounded border border-line bg-canvas/30 hover:bg-line/10 transition-colors"
              >
                <div className="flex flex-col gap-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-sans font-bold text-xs text-ink">
                      {member.name}
                    </span>
                    <span className="font-mono text-[7px] bg-power-on/15 text-power-on border border-power-on/25 px-1 rounded uppercase tracking-wider">
                      {member.id === "nafisa" ? "Lead Developer" : "Systems Admin"}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-ink-muted">
                    ✉ {member.email}
                  </p>
                  <p className="font-mono text-[10px] text-ink-muted">
                    📞 {member.phone}
                  </p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-power-on animate-pulse self-center" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Panel Footer */}
      <div className="border-t border-line pt-2 mt-4 text-[9px] font-mono text-ink-muted flex justify-between select-none">
        <span>ROLE: REGISTERED</span>
        <span>ACCESS: LIVE</span>
      </div>
    </div>
  );
}
