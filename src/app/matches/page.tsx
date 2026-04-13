import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import {
  startOfDay,
  endOfDay,
  addDays,
  format,
  parse,
  isValid,
} from "date-fns";
import {
  getMatchesForDateRange,
  getMatchDaySummary,
  getCompetitionsWithMatches,
  getRecentFinishedMatches,
} from "@/lib/queries/matches";
import { PageHeader } from "@/components/layout/page-header";
import { BreadcrumbJsonLd, ItemListJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { MatchesContent } from "@/components/matches/matches-content";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    title: "Football Matches — Live Scores, Fixtures & Results | DataSports",
    description: `Live football scores, upcoming fixtures and recent results for ${today}. Browse matches across all major competitions.`,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}/matches`,
    },
  };
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;

  // Parse selected date from query param, default to today
  const now = new Date();
  let selectedDate = now;
  if (date) {
    const parsed = parse(date, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) {
      selectedDate = parsed;
    }
  }

  // Compute date range: yesterday through +7 days from selected date
  const yesterdayStart = startOfDay(addDays(selectedDate, -1));
  const weekEnd = endOfDay(addDays(selectedDate, 7));
  const todayStart = startOfDay(selectedDate);
  const tomorrowStart = startOfDay(addDays(selectedDate, 1));

  // Fetch all data in parallel
  const [allMatches, summary, competitions, recentResults] = await Promise.all([
    getMatchesForDateRange(yesterdayStart, weekEnd),
    getMatchDaySummary(todayStart, tomorrowStart),
    getCompetitionsWithMatches(yesterdayStart, weekEnd),
    getRecentFinishedMatches(20),
  ]);

  const competitionCount = competitions.length;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Matches", url: `${BASE_URL}/matches` },
        ]}
      />
      <CollectionPageJsonLd
        name="Football Matches"
        description="Live football scores, upcoming fixtures and recent results across all major competitions."
        url={`${BASE_URL}/matches`}
      />
      <ItemListJsonLd
        name="Football Matches"
        items={allMatches.slice(0, 30).map((m, i) => ({
          position: i + 1,
          url: m.slug ? `${BASE_URL}/matches/${m.slug}` : `${BASE_URL}/matches/${m.id}`,
          name: `${m.homeTeamName} vs ${m.awayTeamName}`,
        }))}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          compact
          title="Matches"
          subtitle={`Live scores, fixtures & results across ${competitionCount} competitions`}
          accentColor="bg-red-700"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Matches" },
          ]}
          icon={<Calendar className="w-7 h-7 text-red-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <MatchesContent
            allMatches={allMatches}
            competitions={competitions}
            summary={summary}
            recentResults={recentResults}
            selectedDate={selectedDate.toISOString()}
            competitionCount={competitionCount}
          />
        </div>
      </div>
    </>
  );
}
