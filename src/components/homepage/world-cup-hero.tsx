"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Globe, Trophy, Users } from "lucide-react";

const KICKOFF = new Date("2026-06-11T00:00:00Z").getTime();
// Final per API-Football season window (2026-06-11 → 2026-07-07).
const FINAL = new Date("2026-07-07T23:59:59Z").getTime();

type Phase = "upcoming" | "live" | "finished";

function getPhase(): Phase {
  const now = Date.now();
  if (now < KICKOFF) return "upcoming";
  if (now <= FINAL) return "live";
  return "finished";
}

function getTimeLeft() {
  const now = Date.now();
  const diff = KICKOFF - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function WorldCupHero() {
  const [time, setTime] = useState(getTimeLeft);
  const [phase, setPhase] = useState<Phase>(getPhase);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(getTimeLeft());
      setPhase(getPhase());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const badge =
    phase === "live" ? "Live Now" : phase === "finished" ? "Tournament Review" : "Coming Soon";

  return (
    <section className="bg-gradient-to-br from-emerald-700 via-teal-700 to-blue-800 text-white">
      <div className="max-w-7xl mx-auto px-4 py-14 md:py-20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
                {phase === "live" && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse mr-1.5 align-middle" />
                )}
                {badge}
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2">
              FIFA World Cup 2026
            </h2>
            <p className="text-lg text-white/80 mb-6">
              United States, Mexico &amp; Canada
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/world-cup-2026"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface text-emerald-700 font-bold rounded-full hover:shadow-lg transition-all text-sm"
              >
                <Globe className="w-4 h-4" />
                {phase === "live" ? "Groups, Results & Fixtures" : "World Cup Hub"}
              </Link>
              <Link
                href="/players"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface/15 hover:bg-surface/25 border border-white/20 font-semibold rounded-full transition-all text-sm"
              >
                <Users className="w-4 h-4" />
                Browse Players
              </Link>
            </div>
          </div>

          {phase === "upcoming" ? (
            <div className="flex items-center gap-3 md:gap-5">
              {[
                { value: time.days, label: "Days" },
                { value: time.hours, label: "Hours" },
                { value: time.minutes, label: "Min" },
                { value: time.seconds, label: "Sec" },
              ].map((unit) => (
                <div key={unit.label} className="text-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-surface/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl md:text-3xl font-bold tabular-nums">
                      {String(unit.value).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-xs text-white/60 mt-1.5 block font-medium">
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center md:text-right">
              <div className="text-5xl md:text-6xl font-extrabold text-yellow-300">48</div>
              <div className="text-sm text-white/70 font-medium">teams · 12 groups · 3 hosts</div>
              <div className="text-xs text-white/50 mt-1">
                {phase === "live" ? "Knockout stage under way — final Jul 7" : "The biggest World Cup ever played"}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
