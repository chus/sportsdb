import type { Metadata } from "next";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Match Detail",
  description: "Match events, lineups, and statistics",
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-4">Match: {id}</h1>
      <p className="text-neutral-500">
        Match page will be built in Phase 5. See docs/figma-reference/MatchPage.tsx for design.
      </p>
    </div>
  );
}
