"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";

interface Season {
  id: string;
  label: string;
  isCurrent: boolean;
}

interface EntitySeasonSelectorProps {
  selectedSeasonId?: string | null;
  onSeasonChange: (seasonId: string | null) => void;
  variant?: "default" | "compact";
}

export function EntitySeasonSelector({
  selectedSeasonId,
  onSeasonChange,
  variant = "default",
}: EntitySeasonSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSeasons() {
      try {
        const response = await fetch("/api/seasons");
        if (response.ok) {
          const data = await response.json();
          setSeasons(data.seasons);
        }
      } catch (error) {
        console.error("Failed to fetch seasons:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSeasons();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedSeason = selectedSeasonId
    ? seasons.find((s) => s.id === selectedSeasonId)
    : seasons.find((s) => s.isCurrent);

  const handleSelect = (season: Season | null) => {
    setIsOpen(false);
    onSeasonChange(season?.isCurrent ? null : season?.id || null);
  };

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-lg text-sm text-neutral-400 animate-pulse">
        <Calendar className="w-4 h-4" />
        <span>Loading...</span>
      </div>
    );
  }

  if (seasons.length === 0) {
    return null;
  }

  const isCompact = variant === "compact";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 border border-neutral-200 rounded-lg font-medium hover:bg-neutral-50 transition-colors ${
          isCompact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        }`}
      >
        <Calendar className={isCompact ? "w-3 h-3 text-neutral-500" : "w-4 h-4 text-neutral-500"} />
        <span>{selectedSeason?.label || "All Time"}</span>
        {selectedSeason?.isCurrent && (
          <span className={`bg-green-100 text-green-700 rounded ${isCompact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-xs"}`}>
            Current
          </span>
        )}
        <ChevronDown className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""} ${isCompact ? "w-3 h-3" : "w-4 h-4"}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg z-30 py-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => handleSelect(seasons.find((s) => s.isCurrent) || null)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between ${
              !selectedSeasonId || selectedSeason?.isCurrent ? "bg-blue-50 text-blue-700" : "text-neutral-700"
            }`}
          >
            <span>Current Season</span>
          </button>
          <div className="h-px bg-neutral-100 my-1" />
          {seasons.map((season) => (
            <button
              key={season.id}
              onClick={() => handleSelect(season)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between ${
                season.id === selectedSeasonId && !season.isCurrent ? "bg-blue-50 text-blue-700" : "text-neutral-700"
              }`}
            >
              <span>{season.label}</span>
              {season.isCurrent && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
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
