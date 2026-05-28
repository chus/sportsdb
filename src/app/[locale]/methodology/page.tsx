import type { Metadata } from "next";
import { Database, RefreshCw, BarChart3, Globe, PenTool, Shield } from "lucide-react";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Methodology – How We Source & Present Football Data",
  description:
    "Learn how DataSports collects, processes, and presents football data. Our methodology covers data sources, update frequency, quality practices, and editorial standards.",
  openGraph: {
    title: "Methodology – How We Source & Present Football Data",
    description:
      "Learn how DataSports collects, processes, and presents football data. Our methodology covers data sources, update frequency, quality practices, and editorial standards.",
    url: `${BASE_URL}/methodology`,
  },
  alternates: {
    canonical: `${BASE_URL}/methodology`,
  },
};

export default function MethodologyPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Methodology", url: `${BASE_URL}/methodology` },
        ]}
      />
      <FAQJsonLd
        items={[
          {
            question: "Where does DataSports get its football data?",
            answer: "DataSports aggregates football data from multiple trusted providers including Football-Data.org for match results, standings, and competition structures, and API-Football for player profiles, squad information, transfer records, and match events.",
          },
          {
            question: "How often is the data updated?",
            answer: "Match results and standings are updated automatically after each matchday, typically within a few hours. Squad rosters and player profiles are refreshed weekly. Transfer records are updated daily during active windows and weekly off-season.",
          },
          {
            question: "How does DataSports ensure data quality?",
            answer: "We employ a multi-signal quality scoring system evaluating every entity page. Teams and players are scored on data completeness. Pages below our quality threshold are excluded from search engine indexing until enriched. We use time-aware modeling and automated audits to flag anomalies.",
          },
          {
            question: "How is editorial content generated?",
            answer: "Match reports, round recaps, player spotlights, and season reviews are generated with AI assistance using real match data and verified statistics. Every article is grounded in actual results — we never fabricate statistics or outcomes.",
          },
          {
            question: "Which competitions does DataSports cover?",
            answer: "We cover the Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Primeira Liga, Eredivisie, Brasileirão Série A, Primera División (Argentina), UEFA Champions League, UEFA Europa League, Copa Libertadores, and the FIFA World Cup.",
          },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Methodology"
          subtitle="How we source, process, and present football data"
          accentColor="bg-indigo-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Methodology" },
          ]}
          icon={<Database className="w-7 h-7 text-indigo-300" />}
        />

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="prose prose-neutral max-w-none">
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 m-0">Data Sources</h2>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                DataSports aggregates football data from multiple trusted providers to build a
                comprehensive and accurate picture of competitions worldwide. Our primary data
                sources include Football-Data.org for match results, standings, and competition
                structures across European football, and API-Football for expanded player
                profiles, squad information, transfer records, and match events. By cross-referencing
                multiple sources, we reduce the risk of incomplete or inaccurate data reaching
                our pages.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                We currently cover the top-tier leagues in England, Spain, Germany, Italy, France,
                Portugal, the Netherlands, Brazil, and Argentina, as well as major international
                tournaments including the UEFA Champions League, UEFA Europa League, Copa Libertadores, and
                the FIFA World Cup. Our coverage expands as we onboard additional data providers.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 m-0">Update Frequency</h2>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                Match results and standings are updated automatically after each matchday,
                typically within a few hours of the final whistle. Squad rosters and player
                profiles are refreshed weekly to capture new signings, loan moves, and contract
                changes. Transfer records are updated daily during active transfer windows and
                weekly during the off-season.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Season-level statistics — including goals, assists, appearances, and clean
                sheets — are recalculated with each data sync. Historical data for past
                seasons is preserved and remains accessible for comparison and analysis.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 m-0">Data Quality</h2>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                We employ a multi-signal quality scoring system to evaluate every entity page
                on the site. Teams are scored based on the completeness of their data — including
                location, founding year, logo, squad size, and current standings. Players are
                scored on profile completeness, career history depth, and season statistics.
                Pages that fall below our quality threshold are excluded from search engine
                indexing until their data is enriched to meet our standards.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Our data pipeline uses time-aware modeling with valid_from and valid_to
                timestamps for player careers, ensuring that squad membership and transfer
                history accurately reflect real-world timelines. Deduplication is enforced
                through external API IDs, and automated audits flag anomalies such as
                missing positions, numeric city values, or truncated names for manual review.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <PenTool className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 m-0">Editorial Content</h2>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                Match reports, round recaps, player spotlights, and season reviews are generated
                with AI assistance using real match data, verified statistics, and contextual
                information from our database. Every article is grounded in actual results — we
                never fabricate statistics or outcomes. Article content is generated using
                structured prompts that reference real match events, standings data, and player
                performance metrics.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Entity biographies for teams, players, competitions, and venues are generated
                procedurally from database records, incorporating current season context,
                career statistics, and competitive standings. These biographies update
                automatically as underlying data changes throughout the season.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 m-0">Competitions Covered</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-neutral-700">
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Premier League (England)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  La Liga (Spain)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Bundesliga (Germany)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Serie A (Italy)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Ligue 1 (France)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Primeira Liga (Portugal)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Eredivisie (Netherlands)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Brasileirão Série A (Brazil)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Primera División (Argentina)
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  UEFA Champions League
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  UEFA Europa League
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  Copa Libertadores
                </div>
                <div className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  FIFA World Cup 2026
                </div>
              </div>
            </section>

            <section>
              <p className="text-neutral-500 text-sm">
                Questions about our data or methodology? Contact us at{" "}
                <a
                  href="mailto:hello@datasports.co"
                  className="text-blue-600 hover:underline"
                >
                  hello@datasports.co
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
