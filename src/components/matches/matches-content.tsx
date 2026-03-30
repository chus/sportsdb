"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  format, addDays, parseISO, isSameDay,
  isToday as dateFnsIsToday, startOfDay,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Calendar, Trophy, Zap,
} from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { LiveMatchesSection } from "@/components/live/live-matches-section";
import type { HubMatch } from "@/lib/queries/matches";

interface MatchesContentProps {
  allMatches: HubMatch[];
  competitions: {
    id: string; name: string; slug: string;
    logoUrl: string | null; matchCount: number;
  }[];
  summary: {
    totalMatches: number; finishedMatches: number;
    totalGoals: number; redCards: number;
    biggestWin: {
      matchId: string; homeTeam: string; awayTeam: string;
      homeScore: number; awayScore: number;
    } | null;
  };
  recentResults: HubMatch[];
  selectedDate: string;
  competitionCount: number;
}

// -- Helpers ----------------------------------------------------------------

function groupByCompetition(matches: HubMatch[]) {
  const map = new Map<string, {
    competition: { id: string; name: string; slug: string; logoUrl: string | null };
    matches: HubMatch[];
  }>();
  for (const m of matches) {
    const existing = map.get(m.competitionId);
    if (existing) {
      existing.matches.push(m);
    } else {
      map.set(m.competitionId, {
        competition: { id: m.competitionId, name: m.competitionName, slug: m.competitionSlug, logoUrl: m.competitionLogoUrl },
        matches: [m],
      });
    }
  }
  return map;
}

function groupByDate(matches: HubMatch[]) {
  const map = new Map<string, HubMatch[]>();
  for (const m of matches) {
    const key = format(parseISO(m.scheduledAt), "yyyy-MM-dd");
    const existing = map.get(key);
    if (existing) existing.push(m);
    else map.set(key, [m]);
  }
  return map;
}

function filterByComp(matches: HubMatch[], compId: string | null) {
  if (!compId) return matches;
  return matches.filter((m) => m.competitionId === compId);
}

// -- Inline sub-components --------------------------------------------------

function MatchStatusBadge({ match }: { match: HubMatch }) {
  switch (match.status) {
    case "finished":
      return <span className="text-xs font-medium text-neutral-500">FT</span>;
    case "live":
    case "half_time":
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
          {match.status === "half_time" ? "HT" : match.minute ? `${match.minute}'` : "LIVE"}
        </span>
      );
    case "scheduled":
      return <span className="text-xs text-neutral-600">{format(parseISO(match.scheduledAt), "HH:mm")}</span>;
    case "postponed":
      return <span className="text-xs text-orange-500">PP</span>;
    case "cancelled":
      return <span className="text-xs text-neutral-400">CAN</span>;
    default:
      return <span className="text-xs text-neutral-400">-</span>;
  }
}

function MatchRow({ match }: { match: HubMatch }) {
  const showScore = match.status === "finished" || match.status === "live" || match.status === "half_time";
  return (
    <Link href={`/matches/${match.id}`} className="flex items-center gap-3 py-2.5 px-3 hover:bg-neutral-50 rounded-lg transition-colors group">
      <div className="w-16 flex-shrink-0 text-center"><MatchStatusBadge match={match} /></div>
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <span className="truncate text-sm text-neutral-900 text-right">{match.homeTeamName}</span>
        <ImageWithFallback src={match.homeTeamLogoUrl} alt={match.homeTeamName} width={20} height={20} className="w-5 h-5 flex-shrink-0 rounded-sm object-contain" />
      </div>
      <div className="w-16 flex-shrink-0 text-center">
        {showScore
          ? <span className="text-sm font-semibold text-neutral-900">{match.homeScore ?? 0} - {match.awayScore ?? 0}</span>
          : <span className="text-sm text-neutral-400">vs</span>}
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <ImageWithFallback src={match.awayTeamLogoUrl} alt={match.awayTeamName} width={20} height={20} className="w-5 h-5 flex-shrink-0 rounded-sm object-contain" />
        <span className="truncate text-sm text-neutral-900">{match.awayTeamName}</span>
      </div>
    </Link>
  );
}

function CompetitionGroupHeader({ competition }: { competition: { name: string; logoUrl: string | null } }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-lg">
      <ImageWithFallback src={competition.logoUrl} alt={competition.name} width={24} height={24} className="w-6 h-6 flex-shrink-0 rounded-sm object-contain" />
      <span className="text-sm font-semibold text-neutral-700">{competition.name}</span>
    </div>
  );
}

function MatchDaySection({
  title, matches, collapsibleMobile = false, emptyMessage,
}: {
  title: string; matches: HubMatch[]; collapsibleMobile?: boolean; emptyMessage?: string;
}) {
  const [collapsed, setCollapsed] = useState(collapsibleMobile);
  const grouped = useMemo(() => groupByCompetition(matches), [matches]);
  if (matches.length === 0 && !emptyMessage) return null;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <button
        type="button"
        onClick={() => collapsibleMobile && setCollapsed((p) => !p)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200 ${collapsibleMobile ? "cursor-pointer" : "cursor-default"}`}
      >
        <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-blue-600" />
          {title}
          <span className="text-xs font-normal text-neutral-500">{matches.length} match{matches.length !== 1 ? "es" : ""}</span>
        </h2>
        {collapsibleMobile && (collapsed
          ? <ChevronDown className="w-4 h-4 text-neutral-400" />
          : <ChevronUp className="w-4 h-4 text-neutral-400" />)}
      </button>

      {!collapsed && (
        <div className="divide-y divide-neutral-100">
          {matches.length === 0 && emptyMessage ? (
            <div className="py-8 text-center">
              <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">{emptyMessage}</p>
              <p className="text-xs text-neutral-400 mt-1">Try navigating to another day</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([compId, group]) => (
              <div key={compId} className="py-2">
                <CompetitionGroupHeader competition={group.competition} />
                <div>{group.matches.map((m) => <MatchRow key={m.id} match={m} />)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

// -- Main export ------------------------------------------------------------

export function MatchesContent({
  allMatches, competitions, summary, recentResults, selectedDate, competitionCount,
}: MatchesContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);

  // Parsed date values
  const parsedDate = useMemo(() => parseISO(selectedDate), [selectedDate]);
  const isToday = useMemo(() => dateFnsIsToday(parsedDate), [parsedDate]);
  const prevDateStr = useMemo(() => format(addDays(parsedDate, -1), "yyyy-MM-dd"), [parsedDate]);
  const nextDateStr = useMemo(() => format(addDays(parsedDate, 1), "yyyy-MM-dd"), [parsedDate]);
  const yesterdayDate = useMemo(() => addDays(parsedDate, -1), [parsedDate]);

  // Derived match groups
  const todayMatches = useMemo(
    () => filterByComp(allMatches.filter((m) => isSameDay(parseISO(m.scheduledAt), parsedDate)), selectedCompetition),
    [allMatches, parsedDate, selectedCompetition],
  );
  const yesterdayMatches = useMemo(
    () => filterByComp(allMatches.filter((m) => isSameDay(parseISO(m.scheduledAt), yesterdayDate)), selectedCompetition),
    [allMatches, yesterdayDate, selectedCompetition],
  );
  const upcomingMatches = useMemo(() => {
    const start = startOfDay(addDays(parsedDate, 1));
    const end = addDays(parsedDate, 8);
    return filterByComp(allMatches.filter((m) => { const d = parseISO(m.scheduledAt); return d >= start && d < end; }), selectedCompetition);
  }, [allMatches, parsedDate, selectedCompetition]);
  const upcomingByDate = useMemo(() => groupByDate(upcomingMatches), [upcomingMatches]);
  const filteredRecentResults = useMemo(() => filterByComp(recentResults, selectedCompetition), [recentResults, selectedCompetition]);

  // Collapsible upcoming dates -- first date expanded by default
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    const first = Array.from(upcomingByDate.keys())[0];
    return first ? new Set([first]) : new Set();
  });
  function toggleDate(dateKey: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey); else next.add(dateKey);
      return next;
    });
  }

  function navigateDate(dateStr: string) { router.push(`${pathname}?date=${dateStr}`); }

  const activeCompetitionName = selectedCompetition ? competitions.find((c) => c.id === selectedCompetition)?.name : null;
  const todayEmpty = activeCompetitionName
    ? `No ${activeCompetitionName} matches on this day`
    : `No matches scheduled for ${format(parsedDate, "MMMM d, yyyy")}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Competition Filter Bar */}
      <div className="sticky top-[65px] z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 -mx-4 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setSelectedCompetition(null)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCompetition === null ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
          >
            All <span className="text-xs opacity-75">({competitionCount})</span>
          </button>
          {competitions.map((comp) => (
            <button
              key={comp.id}
              type="button"
              onClick={() => setSelectedCompetition(selectedCompetition === comp.id ? null : comp.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCompetition === comp.id ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
            >
              <ImageWithFallback src={comp.logoUrl} alt={comp.name} width={20} height={20} className="w-5 h-5 flex-shrink-0 rounded-sm object-contain" />
              <span className="whitespace-nowrap">{comp.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="sticky top-[121px] z-20 bg-white/95 backdrop-blur-md border-b border-neutral-200 -mx-4 px-4 py-3 flex items-center justify-between">
        <button type="button" onClick={() => navigateDate(prevDateStr)} className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
          <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Prev</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900">{format(parsedDate, "EEEE, MMMM d, yyyy")}</span>
          {isToday && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Today</span>}
        </div>
        <button type="button" onClick={() => navigateDate(nextDateStr)} className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
          <span className="hidden sm:inline">Next</span><ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-8">
          <LiveMatchesSection />

          <MatchDaySection title="Today's Matches" matches={todayMatches} emptyMessage={todayEmpty} />

          {yesterdayMatches.length > 0 && (
            <MatchDaySection title="Yesterday" matches={yesterdayMatches} collapsibleMobile />
          )}

          {/* Upcoming This Week */}
          {upcomingByDate.size > 0 && (
            <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />Upcoming This Week
                </h2>
              </div>
              <div className="divide-y divide-neutral-100">
                {Array.from(upcomingByDate.entries()).map(([dateKey, dateMatches]) => {
                  const isExpanded = expandedDates.has(dateKey);
                  const grouped = groupByCompetition(dateMatches);
                  return (
                    <div key={dateKey}>
                      <button type="button" onClick={() => toggleDate(dateKey)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors">
                        <span className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                          {format(parseISO(dateKey), "EEEE, MMMM d")}
                          <span className="text-xs text-neutral-500">{dateMatches.length} match{dateMatches.length !== 1 ? "es" : ""}</span>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-2 pb-3">
                          {Array.from(grouped.entries()).map(([compId, group]) => (
                            <div key={compId} className="mb-2 last:mb-0">
                              <CompetitionGroupHeader competition={group.competition} />
                              {group.matches.map((m) => <MatchRow key={m.id} match={m} />)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent Results */}
          {filteredRecentResults.length > 0 && (
            <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-blue-600" />Recent Results
                </h2>
              </div>
              <div className="divide-y divide-neutral-100">
                {filteredRecentResults.map((m) => (
                  <Link key={m.id} href={`/matches/${m.id}`} className="flex items-center gap-3 py-2.5 px-3 hover:bg-neutral-50 transition-colors">
                    <span className="w-14 flex-shrink-0 text-xs text-neutral-500 text-center">{format(parseISO(m.scheduledAt), "MMM d")}</span>
                    <ImageWithFallback src={m.competitionLogoUrl} alt={m.competitionName} width={16} height={16} className="w-4 h-4 flex-shrink-0 rounded-sm object-contain" />
                    <span className="flex-1 text-sm text-neutral-900 text-right truncate">{m.homeTeamName}</span>
                    <span className="w-12 text-center text-sm font-semibold text-neutral-900">{m.homeScore ?? 0} - {m.awayScore ?? 0}</span>
                    <span className="flex-1 text-sm text-neutral-900 truncate">{m.awayTeamName}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar -- desktop only */}
        <div className="hidden lg:block w-80 flex-shrink-0 space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-4">Match Day Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Matches" value={summary.totalMatches} />
              <StatItem label="Goals" value={summary.totalGoals} />
              <StatItem label="Finished" value={summary.finishedMatches} />
              <StatItem label="Red Cards" value={summary.redCards} />
            </div>
            {summary.biggestWin && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-500 mb-1">Biggest Win</p>
                <Link href={`/matches/${summary.biggestWin.matchId}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                  {summary.biggestWin.homeTeam} {summary.biggestWin.homeScore} - {summary.biggestWin.awayScore} {summary.biggestWin.awayTeam}
                </Link>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
            <Zap className="w-8 h-8 mb-3 text-white/90" />
            <h3 className="font-semibold text-lg">Predict Today&apos;s Matches</h3>
            <p className="text-blue-100 text-sm mt-1">Test your football knowledge</p>
            <Link href="/games/prode" className="mt-3 inline-flex items-center bg-white text-blue-600 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-50 transition-colors">
              Play Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
