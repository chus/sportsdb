export type TimeMode = "now" | "season";

export interface TimeContext {
  mode: TimeMode;
  seasonId: string | null; // UUID of selected season, null when mode is 'now'
}

export interface TimeToggleProps {
  currentMode: TimeMode;
  selectedSeasonId: string | null;
  seasons: { id: string; label: string }[];
  onModeChange: (mode: TimeMode) => void;
  onSeasonChange: (seasonId: string) => void;
}
