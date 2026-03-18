import { Metadata } from "next";
import { ComparePageContent } from "./compare-content";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Player Comparison",
  description: "Compare player statistics side by side",
};

export default function ComparePage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Compare Players", url: `${BASE_URL}/compare` },
        ]}
      />
      <ComparePageContent />
    </>
  );
}
