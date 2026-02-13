import type { Metadata } from "next";

interface CompetitionPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CompetitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Competition standings, results, and statistics`,
  };
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { slug } = await params;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-4">Competition: {slug}</h1>
      <p className="text-neutral-500">
        Competition page will be built in Phase 4. See docs/figma-reference/CompetitionPage.tsx for design.
      </p>
    </div>
  );
}
