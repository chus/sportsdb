import { Metadata } from "next";
import { AdvancedStatsContent } from "./stats-content";

export const metadata: Metadata = {
  title: "Advanced Stats",
  description: "Access advanced player statistics including radar charts, heat maps, and xG analytics",
};

export default function AdvancedStatsPage() {
  return <AdvancedStatsContent />;
}
