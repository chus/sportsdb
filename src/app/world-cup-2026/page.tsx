import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, MapPin, Users, Calendar, ChevronRight, Globe } from "lucide-react";
import { db } from "@/lib/db";
import { competitions, competitionSeasons, standings, teams, venues, seasons } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { JsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { PageTracker } from "@/components/analytics/page-tracker";
import { CountdownTimer } from "./countdown-timer";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";
const WC_START_DATE = "2026-06-11T00:00:00Z";

export const metadata: Metadata = {
  title: "FIFA World Cup 2026 – Countdown, Host Countries & Key Players",
  description:
    "Everything about the FIFA World Cup 2026 hosted by USA, Mexico, and Canada. 48 teams, 12 groups, 16 stadiums. Explore groups, venues, key players, and countdown to kickoff.",
  openGraph: {
    title: "FIFA World Cup 2026 – The Biggest World Cup Ever",
    description:
      "48 teams, 12 groups, 16 stadiums across 3 countries. Explore the first expanded World Cup.",
    url: `${BASE_URL}/world-cup-2026`,
    type: "website",
    siteName: "DataSports",
  },
  twitter: {
    card: "summary_large_image",
    title: "FIFA World Cup 2026",
    description:
      "48 teams, 12 groups, 16 stadiums. Everything about the World Cup 2026.",
  },
  keywords: [
    "World Cup 2026",
    "FIFA World Cup",
    "World Cup USA",
    "World Cup Mexico",
    "World Cup Canada",
    "football",
    "soccer",
    "48 teams",
    "world cup groups",
    "world cup venues",
    "world cup schedule",
  ],
  alternates: {
    canonical: `${BASE_URL}/world-cup-2026`,
  },
};

async function getWorldCupData() {
  // Find the World Cup competition
  const [wc] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "fifa-world-cup-2026"))
    .limit(1);

  if (!wc) return null;

  // Find competition season
  const [compSeason] = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, wc.id))
    .limit(1);

  if (!compSeason) return { competition: wc, groups: [], venues: [] };

  // Get standings with team info
  const standingsData = await db
    .select({
      standing: standings,
      team: teams,
    })
    .from(standings)
    .innerJoin(teams, eq(teams.id, standings.teamId))
    .where(eq(standings.competitionSeasonId, compSeason.id));

  // Group by the form field (which stores group letter)
  const groups: Record<string, typeof standingsData> = {};
  for (const row of standingsData) {
    const group = row.standing.form || "?";
    if (!groups[group]) groups[group] = [];
    groups[group].push(row);
  }

  // Sort groups alphabetically
  const sortedGroups = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, entries]) => ({
      letter,
      teams: entries.sort((a, b) => a.standing.position - b.standing.position),
    }));

  // Get venues
  const allVenues = await db
    .select()
    .from(venues)
    .where(eq(venues.country, "United States"));

  const mexVenues = await db.select().from(venues).where(eq(venues.country, "Mexico"));
  const canVenues = await db.select().from(venues).where(eq(venues.country, "Canada"));

  // Filter to WC venues by capacity (>30000)
  const wcVenues = [...allVenues, ...mexVenues, ...canVenues].filter(
    (v) => v.capacity && v.capacity >= 30000
  );

  return { competition: wc, groups: sortedGroups, venues: wcVenues };
}

export default async function WorldCup2026Page() {
  const data = await getWorldCupData();

  const hostCountries = [
    { name: "United States", flag: "🇺🇸", stadiums: 11 },
    { name: "Mexico", flag: "🇲🇽", stadiums: 3 },
    { name: "Canada", flag: "🇨🇦", stadiums: 2 },
  ];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "World Cup 2026", url: `${BASE_URL}/world-cup-2026` },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: "FIFA World Cup 2026",
          description:
            "The 23rd FIFA World Cup, jointly hosted by the United States, Mexico, and Canada. 48 teams, 12 groups, 104 matches across 16 stadiums.",
          startDate: WC_START_DATE,
          endDate: "2026-07-19T00:00:00Z",
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          sport: "https://www.wikidata.org/entity/Q2736",
          location: [
            { "@type": "Country", name: "United States" },
            { "@type": "Country", name: "Mexico" },
            { "@type": "Country", name: "Canada" },
          ],
          organizer: {
            "@type": "Organization",
            name: "FIFA",
            url: "https://www.fifa.com",
          },
          url: `${BASE_URL}/world-cup-2026`,
          numberOfAttendees: { "@type": "QuantitativeValue", value: 48, unitText: "teams" },
        }}
      />
      <PageTracker />
      <FAQJsonLd
        items={[
          {
            question: "When is the FIFA World Cup 2026?",
            answer: "The FIFA World Cup 2026 runs from June 11 to July 19, 2026.",
          },
          {
            question: "Where is the World Cup 2026 being held?",
            answer: "The 2026 World Cup is jointly hosted by the United States (11 stadiums), Mexico (3 stadiums), and Canada (2 stadiums) across 16 venues.",
          },
          {
            question: "How many teams are in the World Cup 2026?",
            answer: "The 2026 World Cup features 48 teams divided into 12 groups of 4, making it the first expanded World Cup format.",
          },
          {
            question: "How many matches will be played at the World Cup 2026?",
            answer: "A total of 104 matches will be played across the tournament, from the group stage through to the final.",
          },
        ]}
      />

      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-red-700 via-blue-800 to-green-700 text-white py-20 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2MmgxMnptMC00VjI0SDI0djJoMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="max-w-7xl mx-auto px-4 relative">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <span className="text-yellow-400 font-semibold text-lg">FIFA</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              World Cup 2026
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl">
              The first 48-team World Cup. 16 stadiums across the United States, Mexico, and Canada.
            </p>

            <CountdownTimer targetDate={WC_START_DATE} />

            <div className="flex flex-wrap gap-4 mt-8">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <Users className="w-5 h-5" />
                <span className="font-semibold">48 Teams</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <Globe className="w-5 h-5" />
                <span className="font-semibold">12 Groups</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <MapPin className="w-5 h-5" />
                <span className="font-semibold">16 Stadiums</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <Calendar className="w-5 h-5" />
                <span className="font-semibold">June 11 – July 19</span>
              </div>
            </div>
          </div>
        </section>

        {/* Host Countries */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-neutral-900 mb-8">Host Countries</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {hostCountries.map((country) => (
                <div
                  key={country.name}
                  className="bg-white rounded-xl border border-neutral-200 p-8 text-center hover:shadow-xl transition-all"
                >
                  <div className="text-6xl mb-4" role="img" aria-label={`Flag of ${country.name}`}>{country.flag}</div>
                  <h3 className="text-2xl font-bold text-neutral-900 mb-2">{country.name}</h3>
                  <p className="text-neutral-600">
                    {country.stadiums} {country.stadiums === 1 ? "stadium" : "stadiums"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Venues */}
        {data?.venues && data.venues.length > 0 && (
          <section className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center gap-3 mb-8">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h2 className="text-3xl font-bold text-neutral-900">Stadiums & Venues</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {data.venues.map((venue) => (
                  <Link
                    key={venue.id}
                    href={`/venues/${venue.slug}`}
                    className="bg-neutral-50 rounded-xl p-6 border border-neutral-200 hover:shadow-lg hover:border-blue-300 transition-all group"
                  >
                    <h3 className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors mb-1">
                      {venue.name}
                    </h3>
                    <p className="text-sm text-neutral-600">
                      {venue.city}, {venue.country}
                    </p>
                    {venue.capacity && (
                      <p className="text-sm text-neutral-500 mt-2">
                        Capacity: {venue.capacity.toLocaleString()}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Group Stage */}
        {data?.groups && data.groups.length > 0 && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center gap-3 mb-8">
                <Trophy className="w-6 h-6 text-yellow-600" />
                <h2 className="text-3xl font-bold text-neutral-900">Group Stage</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {data.groups.map((group) => (
                  <div
                    key={group.letter}
                    className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
                      <h3 className="text-white font-bold text-lg">Group {group.letter}</h3>
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {group.teams.map(({ team }) => (
                        <Link
                          key={team.id}
                          href={`/teams/${team.slug}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors group"
                        >
                          <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-bold text-neutral-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                            {team.shortName?.substring(0, 3) || team.name.substring(0, 3).toUpperCase()}
                          </div>
                          <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                            {team.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Key Players to Watch */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-8">
              <Users className="w-6 h-6 text-orange-500" />
              <h2 className="text-3xl font-bold text-neutral-900">Key Players to Watch</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: "Kylian Mbappé", team: "France", position: "Forward", slug: "kylian-mbappe" },
                { name: "Erling Haaland", team: "Norway", position: "Forward", slug: "erling-haaland" },
                { name: "Jude Bellingham", team: "England", position: "Midfielder", slug: "jude-bellingham" },
                { name: "Vinícius Júnior", team: "Brazil", position: "Forward", slug: "vinicius-junior" },
                { name: "Florian Wirtz", team: "Germany", position: "Midfielder", slug: "florian-wirtz" },
                { name: "Lamine Yamal", team: "Spain", position: "Forward", slug: "lamine-yamal" },
                { name: "Lionel Messi", team: "Argentina", position: "Forward", slug: "lionel-messi" },
                { name: "Christian Pulisic", team: "USA", position: "Forward", slug: "christian-pulisic" },
              ].map((player) => (
                <Link
                  key={player.slug}
                  href={`/players/${player.slug}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-xl hover:border-neutral-300 hover:-translate-y-1 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                    {player.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                      {player.name}
                    </div>
                    <div className="text-sm text-neutral-500 truncate">
                      {player.position} · {player.team}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-blue-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-2xl p-12 text-white text-center">
              <Trophy className="w-16 h-16 mx-auto mb-6 text-yellow-400" />
              <h2 className="text-3xl font-bold mb-4">Follow the World Cup on SportsDB</h2>
              <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
                Track teams, follow players, and stay up to date with every goal, every match, and every moment of the 2026 World Cup.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/teams"
                  className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Explore Teams
                </Link>
                <Link
                  href="/players"
                  className="px-8 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition-all"
                >
                  Explore Players
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
