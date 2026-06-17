import { Calendar, Clock } from "lucide-react";
import { useState } from "react";

interface TimeToggleProps {
  currentView: "now" | "historical";
  onViewChange: (view: "now" | "historical") => void;
  selectedSeason?: string;
  onSeasonChange?: (season: string) => void;
  availableSeasons?: string[];
}

export function TimeToggle({ 
  currentView, 
  onViewChange, 
  selectedSeason = "2025/26",
  onSeasonChange,
  availableSeasons = ["2025/26", "2024/25", "2023/24", "2022/23", "2021/22"]
}: TimeToggleProps) {
  const [isSeasonPickerOpen, setIsSeasonPickerOpen] = useState(false);
  
  return (
    <div className="border border-line bg-surface rounded-lg p-1 flex gap-1 relative">
      <button
        onClick={() => onViewChange("now")}
        className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
          currentView === "now" 
            ? "bg-blue-600 text-white" 
            : "text-ink hover:bg-surface-2"
        }`}
      >
        <Clock className="w-4 h-4" />
        Now
      </button>
      <button
        onClick={() => {
          onViewChange("historical");
          setIsSeasonPickerOpen(true);
        }}
        className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
          currentView === "historical" 
            ? "bg-blue-600 text-white" 
            : "text-ink hover:bg-surface-2"
        }`}
      >
        <Calendar className="w-4 h-4" />
        Season
      </button>
      
      {currentView === "historical" && isSeasonPickerOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsSeasonPickerOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 bg-surface border border-line rounded-lg shadow-lg py-1 min-w-[140px] z-20">
            {availableSeasons.map((season) => (
              <button
                key={season}
                onClick={() => {
                  onSeasonChange?.(season);
                  setIsSeasonPickerOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-surface-2 ${
                  season === selectedSeason ? "font-medium bg-surface-2" : ""
                }`}
              >
                {season}
              </button>
            ))}
          </div>
        </>
      )}
      
      {currentView === "historical" && (
        <div className="absolute -bottom-8 right-0 text-xs text-muted">
          Viewing: {selectedSeason}
        </div>
      )}
    </div>
  );
}
