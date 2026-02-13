import type { Metadata } from "next";

interface CompetitionSeasonPageProps {
  params: Promise<{ slug: string; season: string }>;
}

export async function generateMetadata({ params }: CompetitionSeasonPageProps): Promise<Metadata> {
  const { slug, season } = await params;
  return {
    title: `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ${season}`,
    description: `Standings, results, and top scorers`,
  };
}

export default async function CompetitionSeasonPage({ params }: CompetitionSeasonPageProps) {
  const { slug, season } = await params;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-4">
        Competition: {slug} — Season: {season}
      </h1>
      <p className="text-neutral-500">
        Season-specific competition page will be built in Phase 4.
      </p>
    </div>
  );
}
