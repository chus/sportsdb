import { Link } from "@/i18n/navigation";
import { Trophy, MapPin, Users, Calendar, Award, Flag } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  getTournamentHistory,
  getTrophySummary,
  getTopPlayersByNationality,
} from "@/lib/queries/national-teams";
import { getTeamMatches } from "@/lib/queries/matches";
import { FollowButton } from "@/components/follow-button";
import { PageHeader } from "@/components/layout/page-header";
import { BreadcrumbJsonLd, TeamJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PlayerLink } from "@/components/player/player-link";
import { PageTracker } from "@/components/analytics/page-tracker";
import { getCountryFlagEmoji } from "@/lib/utils/country-flags";

interface Team {
  id: string;
  name: string;
  slug: string;
  country: string;
  shortName: string | null;
  foundedYear: number | null;
  coachName: string | null;
  logoUrl: string | null;
  wikipediaUrl: string | null;
  updatedAt: Date | null;
}

interface Props {
  team: Team;
  baseUrl: string;
}

function tournamentEmoji(key: string): string {
  switch (key) {
    case "fifa-world-cup":
      return "🏆";
    case "copa-america":
      return "🌎";
    case "uefa-euro":
      return "🇪🇺";
    case "afcon":
      return "🌍";
    case "asian-cup":
      return "🌏";
    case "gold-cup":
      return "🌐";
    default:
      return "🏅";
  }
}

function positionLabel(p: number | null): string {
  if (p === 1) return "Champions";
  if (p === 2) return "Runners-up";
  if (p === 3) return "Third place";
  if (p === 4) return "Fourth place";
  return "Appearance";
}

function positionStyle(p: number | null): string {
  if (p === 1) return "bg-amber-100 text-amber-900 border-amber-300";
  if (p === 2) return "bg-neutral-200 text-neutral-700 border-neutral-300";
  if (p === 3) return "bg-orange-100 text-orange-800 border-orange-300";
  if (p === 4) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-neutral-50 text-neutral-600 border-neutral-200";
}

export async function NationalTeamPage({ team, baseUrl }: Props) {
  const [trophies, history, players, matchesData] = await Promise.all([
    getTrophySummary(team.id),
    getTournamentHistory(team.id),
    getTopPlayersByNationality(team.country, 30),
    getTeamMatches(team.id, 5),
  ]);

  const nextMatch = matchesData.upcoming[0] ?? null;
  const recentMatches = matchesData.recent.slice(0, 5);
  const flag = getCountryFlagEmoji(team.country);

  // Group history by tournament for the table view
  const historyByTournament = new Map<
    string,
    { name: string; rows: typeof history }
  >();
  for (const row of history) {
    let entry = historyByTournament.get(row.tournamentKey);
    if (!entry) {
      entry = { name: row.tournamentName, rows: [] };
      historyByTournament.set(row.tournamentKey, entry);
    }
    entry.rows.push(row);
  }

  // Sort World Cup first, then by total appearances desc
  const tournamentSections = [...historyByTournament.entries()].sort(([keyA, a], [keyB, b]) => {
    if (keyA === "fifa-world-cup") return -1;
    if (keyB === "fifa-world-cup") return 1;
    return b.rows.length - a.rows.length;
  });

  const goalkeepers = players.filter((p) => p.position === "Goalkeeper");
  const defenders = players.filter((p) => p.position === "Defender");
  const midfielders = players.filter((p) => p.position === "Midfielder");
  const forwards = players.filter((p) => p.position === "Forward");

  const teamUrl = `${baseUrl}/teams/${team.slug}`;
  const breadcrumbItems = [
    { name: "Home", url: baseUrl },
    { name: "Teams", url: `${baseUrl}/teams` },
    { name: team.name, url: teamUrl },
  ];

  const worldCupTitles = trophies.find((t) => t.tournamentKey === "fifa-world-cup")?.champions ?? 0;
  const continentalTitles = trophies
    .filter((t) => t.tournamentKey !== "fifa-world-cup")
    .reduce((sum, t) => sum + t.champions, 0);

  const faqItems = [
    {
      question: `How many World Cups has ${team.name} won?`,
      answer:
        worldCupTitles > 0
          ? `${team.name} has won the FIFA World Cup ${worldCupTitles} time${worldCupTitles === 1 ? "" : "s"}.`
          : `${team.name} has not won a FIFA World Cup.`,
    },
    {
      question: `Who is the head coach of ${team.name}?`,
      answer: team.coachName
        ? `${team.coachName} is the head coach of ${team.name}.`
        : `The head coach of ${team.name} is not currently recorded.`,
    },
    {
      question: `When was ${team.name} founded?`,
      answer: team.foundedYear
        ? `${team.name} was founded in ${team.foundedYear}.`
        : `The founding year of ${team.name} is not currently recorded.`,
    },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <TeamJsonLd
        name={team.name}
        url={teamUrl}
        logo={team.logoUrl}
        location={{ city: null, country: team.country }}
        foundingDate={team.foundedYear}
        coach={team.coachName}
        athletes={players.slice(0, 25).map((p) => ({
          name: p.name,
          url: `${baseUrl}/players/${p.slug}`,
        }))}
        sameAs={[team.wikipediaUrl].filter(Boolean) as string[]}
        memberOf={null}
      />
      <FAQJsonLd items={faqItems} />
      <PageTracker entityType="team" entityId={team.id} />

      <div className="min-h-screen bg-neutral-50">
        <div className="text-white bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800">
          <PageHeader
            title={team.name}
            subtitle={`${team.country} men's national football team${team.foundedYear ? ` · Est. ${team.foundedYear}` : ""}`}
            accentColor=""
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Teams", href: "/teams" },
              { label: team.name },
            ]}
            icon={
              <div className="relative w-16 h-16 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-2">
                {team.logoUrl ? (
                  <ImageWithFallback src={team.logoUrl} alt={team.name} fill sizes="64px" className="object-contain" priority />
                ) : flag ? (
                  <span className="text-4xl leading-none">{flag}</span>
                ) : (
                  <Flag className="w-8 h-8 text-neutral-300" />
                )}
              </div>
            }
            badges={
              <div className="flex items-center gap-2 flex-wrap">
                {team.shortName && (
                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full tracking-wider">
                    {team.shortName}
                  </span>
                )}
                {team.coachName && (
                  <span className="text-xs font-medium bg-white/20 px-2.5 py-1 rounded-full">
                    Coach: {team.coachName}
                  </span>
                )}
                {worldCupTitles > 0 && (
                  <span className="text-xs font-bold bg-amber-400/30 px-2.5 py-1 rounded-full">
                    {worldCupTitles}× World Cup
                  </span>
                )}
              </div>
            }
            stats={[
              { label: "World Cups", value: worldCupTitles },
              { label: "Continental titles", value: continentalTitles },
              ...(players.length > 0
                ? [{ label: "Squad pool", value: players.length }]
                : []),
            ]}
            actions={
              <FollowButton entityType="team" entityId={team.id} entityName={team.name} variant="hero" />
            }
          />
        </div>
        {team.updatedAt && (
          <p className="text-xs text-neutral-400 mt-2 max-w-7xl mx-auto px-4">
            Updated {formatDistanceToNowStrict(new Date(team.updatedAt), { addSuffix: true })}
          </p>
        )}

        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          {/* Trophy strip */}
          {trophies.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Honours
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {trophies.map((t) => (
                  <div
                    key={t.tournamentKey}
                    className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="text-3xl mb-1.5">{tournamentEmoji(t.tournamentKey)}</div>
                    <h3 className="text-sm font-bold text-neutral-900 leading-tight mb-2">
                      {t.tournamentShortName}
                    </h3>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-baseline gap-1">
                        <span className="text-amber-600 font-bold text-lg leading-none">{t.champions}</span>
                        <span className="text-neutral-600">title{t.champions === 1 ? "" : "s"}</span>
                      </div>
                      {t.runnersUp > 0 && (
                        <div className="text-neutral-500">
                          {t.runnersUp}× runners-up
                        </div>
                      )}
                      {(t.thirdPlace > 0 || t.fourthPlace > 0) && (
                        <div className="text-neutral-400">
                          {t.thirdPlace > 0 && `${t.thirdPlace}× 3rd`}
                          {t.thirdPlace > 0 && t.fourthPlace > 0 && " · "}
                          {t.fourthPlace > 0 && `${t.fourthPlace}× 4th`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tournament history tables */}
          {tournamentSections.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" /> Tournament history
              </h2>
              <div className="space-y-6">
                {tournamentSections.map(([key, entry]) => (
                  <div key={key} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                      <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                        <span>{tournamentEmoji(key)}</span>
                        {entry.name}
                      </h3>
                      <span className="text-xs text-neutral-500">{entry.rows.length} top-4 finish{entry.rows.length === 1 ? "" : "es"}</span>
                    </div>
                    <ul className="divide-y divide-neutral-100">
                      {entry.rows.map((r) => (
                        <li key={`${key}-${r.year}`} className="px-5 py-2.5 flex items-center gap-4 text-sm">
                          <span className="font-mono text-neutral-500 w-12">{r.year}</span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${positionStyle(r.finishingPosition)}`}
                          >
                            {positionLabel(r.finishingPosition)}
                          </span>
                          {r.hostCountry && (
                            <span className="text-neutral-500 text-xs flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {r.hostCountry}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top players by nationality */}
          {players.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" /> Top players
              </h2>
              <p className="text-sm text-neutral-500 mb-4">
                Highest-profile players holding {team.country} nationality. Not an official squad call-up.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: "Goalkeepers", group: goalkeepers },
                  { title: "Defenders", group: defenders },
                  { title: "Midfielders", group: midfielders },
                  { title: "Forwards", group: forwards },
                ]
                  .filter((g) => g.group.length > 0)
                  .map((g) => (
                    <div key={g.title} className="bg-white rounded-xl border border-neutral-200 p-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                        {g.title} ({g.group.length})
                      </h3>
                      <ul className="space-y-2">
                        {g.group.slice(0, 8).map((p) => (
                          <li key={p.id}>
                            <PlayerLink
                              slug={p.slug}
                              isLinkWorthy={(p.popularityScore ?? 0) >= 40}
                              className="flex items-center gap-2 text-sm text-neutral-800 hover:text-blue-600"
                            >
                              {p.knownAs || p.name}
                            </PlayerLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Recent fixtures */}
          {(nextMatch || recentMatches.length > 0) && (
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> Fixtures
              </h2>
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                {nextMatch && (
                  <div className="mb-4 pb-4 border-b border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">Next</p>
                    <Link href={`/matches/${nextMatch.slug ?? nextMatch.id}`} className="text-sm font-medium hover:text-blue-600">
                      {nextMatch.homeTeam?.name} vs {nextMatch.awayTeam?.name}
                    </Link>
                  </div>
                )}
                {recentMatches.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">Recent</p>
                    <ul className="space-y-2 text-sm">
                      {recentMatches.map((m) => (
                        <li key={m.id}>
                          <Link href={`/matches/${m.slug ?? m.id}`} className="hover:text-blue-600">
                            {m.homeTeam?.name} {m.homeScore} - {m.awayScore} {m.awayTeam?.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
