"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatDelta(ms: number): string {
  if (ms <= 0) return "Now";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function WeekCountdownChip({ targetIso }: { targetIso: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(targetIso).getTime();
  const delta = target - Date.now();

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />
      {formatDelta(delta)}
    </span>
  );
}
