import { Metadata } from "next";
import { ComparePageContent } from "./compare-content";

export const metadata: Metadata = {
  title: "Player Comparison",
  description: "Compare player statistics side by side",
};

export default function ComparePage() {
  return <ComparePageContent />;
}
