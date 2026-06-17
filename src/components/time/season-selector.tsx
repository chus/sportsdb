"use client";

import { useRouter } from "@/i18n/navigation";
import { Calendar, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Season {
  label: string;
  urlLabel: string; // URL-friendly format (e.g., "2024-25")
  isCurrent?: boolean;
}

interface SeasonSelectorProps {
  seasons: Season[];
  currentSeason: string;
  competitionSlug: string;
}

export function SeasonSelector({
  seasons,
  currentSeason,
  competitionSlug,
}: SeasonSelectorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSeasonChange = (season: Season) => {
    setIsOpen(false);
    router.push(`/competitions/${competitionSlug}/${season.urlLabel}`);
  };

  const currentSeasonData = seasons.find((s) => s.label === currentSeason);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-surface/20 hover:bg-surface/30 rounded-lg text-sm font-medium transition-colors"
      >
        <Calendar className="w-4 h-4" />
        <span>{currentSeason}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-surface rounded-lg shadow-lg border border-line py-1 min-w-[160px] z-20">
          {seasons.map((season) => (
            <button
              key={season.label}
              onClick={() => handleSeasonChange(season)}
              className={`w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-2 flex items-center justify-between ${
                season.label === currentSeason
                  ? "font-medium bg-surface-2"
                  : ""
              }`}
            >
              <span>{season.label}</span>
              {season.isCurrent && (
                <span className="text-xs text-green-600 font-medium">
                  Current
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
