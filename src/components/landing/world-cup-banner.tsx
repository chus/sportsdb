"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";

const WC_START_DATE = "2026-06-11T00:00:00Z";

export function WorldCupBanner() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  function getTimeLeft() {
    const diff = new Date(WC_START_DATE).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-6">
      <div className="max-w-7xl mx-auto px-4">
        <Link
          href="/world-cup-2026"
          className="block bg-gradient-to-r from-red-700 via-blue-800 to-green-700 rounded-2xl p-6 md:p-8 text-white hover:shadow-2xl transition-all group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Trophy className="w-10 h-10 text-yellow-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-1">
                  FIFA World Cup 2026
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">
                  The Biggest World Cup Ever
                </h2>
                <p className="text-white/80 mt-1">
                  48 teams · 16 stadiums · USA, Mexico & Canada
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex gap-3 text-center">
                <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-2xl font-bold tabular-nums">{timeLeft.days}</div>
                  <div className="text-[10px] text-white/70 uppercase">Days</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-2xl font-bold tabular-nums">{timeLeft.hours}</div>
                  <div className="text-[10px] text-white/70 uppercase">Hours</div>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-2xl font-bold tabular-nums">{timeLeft.minutes}</div>
                  <div className="text-[10px] text-white/70 uppercase">Min</div>
                </div>
              </div>

              <ChevronRight className="w-6 h-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all hidden md:block" />
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
