import React from "react";

type RoomBadgeProps = {
  name: string;
  className?: string;
};

export default function RoomBadge({ name, className = "" }: RoomBadgeProps) {
  return (
    <div
      className={`flex items-center justify-center gap-2 text-[10px] tracking-[0.25em] font-display font-bold uppercase text-ink-muted select-none ${className}`}
    >
      <span className="w-3 h-[1px] bg-line/80 inline-block"></span>
      <span>{name}</span>
      <span className="w-3 h-[1px] bg-line/80 inline-block"></span>
    </div>
  );
}
