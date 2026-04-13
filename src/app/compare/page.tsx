import { Metadata } from "next";
import { ComparePageContent } from "./compare-content";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Compare Players – Side-by-Side Stats | DataSports",
  description:
    "Compare football players side by side. Goals, assists, appearances, and career statistics head-to-head.",
  openGraph: {
    title: "Compare Players – Side-by-Side Stats | DataSports",
    description:
      "Compare football players side by side. Goals, assists, appearances, and career statistics head-to-head.",
    url: `${BASE_URL}/compare`,
  },
  alternates: { canonical: `${BASE_URL}/compare` },
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
