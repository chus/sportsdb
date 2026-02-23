import { Metadata } from "next";
import { PredictionsPageContent } from "./predictions-content";

export const metadata: Metadata = {
  title: "Predictions",
  description: "Predict match scores and compete on the global leaderboard",
};

export default function PredictionsPage() {
  return <PredictionsPageContent />;
}
