import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Shield } from "lucide-react";
import { localizedAlternates } from "@/lib/seo/hreflang";
import { getTeamComparison } from "@/lib/queries/teams";
import { compareMatchup } from "@/lib/seo/compare";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/json-ld";
import { PageTracker } from "@/components/analytics/page-tracker";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ matchup: string }>;
}

function parseMatchup(matchup: string): { slug1: string; slug2: string } | null {
  const idx = matchup.indexOf("-vs-");
  if (idx === -1) return null;
  const slug1 = matchup.slice(0, idx);
  const slug2 = matchup.slice(idx + 4);
  if (!slug1 || !slug2) return null;
  return { slug1, slug2 };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchup } = await params;
  const parsed = parseMatchup(matchup);
  if (!parsed) notFound();
  const cmp = await getTeamComparison(parsed.slug1, parsed.slug2);
  if (!cmp) notFound();

  const canonical = compareMatchup(parsed.slug1, parsed.slug2);
  const title = `${cmp.teamA.name} vs ${cmp.teamB.name} — Head-to-Head & Stats`;
  const description = `Compare ${cmp.teamA.name} and ${cmp.teamB.name}: league position, form, goals, and head-to-head record.`;
  // Index only when both teams have a current league standing (data-dense);
  // otherwise keep it crawlable but out of the index.
  const indexable = !!cmp.standingA && !!cmp.standingB;

  return {
    title,
    description,
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: `${BASE_URL}/compare/teams/${canonical}`, siteName: "DataSports", type: "website" },
    alternates: localizedAlternates(`/compare/teams/${canonical}`),
  };
}

function StatRow({ label, a, b, higherIsBetter = true }: { label: string; a: number; b: number; higherIsBetter?: boolean }) {
  const aWin = higherIsBetter ? a > b : a < b;
  const bWin = higherIsBetter ? b > a : b < a;
  return (
    <div className="flex items-center py-2.5 border-b border-line last:border-0">
      <div className="flex-1 text-right">
        <span className={`text-lg font-semibold ${aWin ? "text-green-600" : a === b ? "text-ink" : "text-muted"}`}>{a}</span>
      </div>
      <div className="w-36 text-center text-sm text-muted">{label}</div>
      <div className="flex-1 text-left">
        <span className={`text-lg font-semibold ${bWin ? "text-green-600" : a === b ? "text-ink" : "text-muted"}`}>{b}</span>
      </div>
    </div>
  );
}

function FormPills({ form }: { form: string | null }) {
  if (!form) return <span className="text-faint text-sm">—</span>;
  return (
    <div className="flex gap-1 justify-center">
      {form.slice(-5).split("").map((r, i) => (
        <span key={i} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white ${r === "W" ? "bg-green-500" : r === "D" ? "bg-neutral-400" : "bg-red-500"}`}>{r}</span>
      ))}
    </div>
  );
}

function TeamHead({ team }: { team: { name: string; slug: string; logoUrl: string | null } }) {
  return (
    <Link href={`/teams/${team.slug}`} className="block text-center p-6 hover:bg-surface-2 rounded-xl transition-colors">
      <div className="w-20 h-20 mx-auto mb-3 flex items-center justify-center">
        {team.logoUrl ? <ImageWithFallback src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" width={80} height={80} /> : <Shield className="w-10 h-10 text-faint" />}
      </div>
      <h2 className="text-lg font-bold text-ink hover:text-blue-600 transition-colors">{team.name}</h2>
    </Link>
  );
}

export default async function TeamComparePage({ params }: PageProps) {
  const { matchup } = await params;
  const parsed = parseMatchup(matchup);
  if (!parsed) notFound();
  const cmp = await getTeamComparison(parsed.slug1, parsed.slug2);
  if (!cmp) notFound();

  const { teamA, teamB, standingA, standingB, h2h } = cmp;
  const sa = standingA?.standing;
  const sb = standingB?.standing;

  // H2H summary relative to teamA.
  let aWins = 0, draws = 0, bWins = 0;
  for (const m of h2h) {
    const aIsHome = m.homeTeamId === teamA.id;
    const aScore = aIsHome ? m.homeScore : m.awayScore;
    const bScore = aIsHome ? m.awayScore : m.homeScore;
    if (aScore > bScore) aWins++;
    else if (aScore < bScore) bWins++;
    else draws++;
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Compare", url: `${BASE_URL}/compare` },
          { name: `${teamA.name} vs ${teamB.name}`, url: `${BASE_URL}/compare/teams/${matchup}` },
        ]}
      />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: `${teamA.name} vs ${teamB.name}`, url: `${BASE_URL}/compare/teams/${matchup}`, about: [
        { "@type": "SportsTeam", name: teamA.name, url: `${BASE_URL}/teams/${teamA.slug}` },
        { "@type": "SportsTeam", name: teamB.name, url: `${BASE_URL}/teams/${teamB.slug}` },
      ] }} />
      <PageTracker />

      <div className="min-h-screen bg-surface-2">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/compare" className="inline-flex items-center gap-2 text-muted hover:text-ink mb-4">&larr; Compare</Link>
          <h1 className="text-3xl font-bold text-ink mb-1">{teamA.name} vs {teamB.name}</h1>
          <p className="text-muted mb-6">Head-to-head record, league standing and form.</p>

          <div className="bg-surface rounded-xl border border-line overflow-hidden">
            <div className="grid grid-cols-3 border-b border-line">
              <div className="border-r border-line"><TeamHead team={teamA} /></div>
              <div className="flex items-center justify-center bg-surface-2"><span className="text-2xl font-bold text-faint">VS</span></div>
              <div className="border-l border-line"><TeamHead team={teamB} /></div>
            </div>

            {/* Head-to-head summary */}
            <div className="p-6 border-b border-line">
              <h3 className="text-sm font-medium text-muted text-center mb-3">Head-to-Head ({h2h.length} {h2h.length === 1 ? "meeting" : "meetings"})</h3>
              {h2h.length > 0 ? (
                <div className="flex items-center justify-center gap-6 text-center">
                  <div><div className="text-2xl font-bold text-green-600">{aWins}</div><div className="text-xs text-muted">{teamA.name} wins</div></div>
                  <div><div className="text-2xl font-bold text-ink">{draws}</div><div className="text-xs text-muted">Draws</div></div>
                  <div><div className="text-2xl font-bold text-green-600">{bWins}</div><div className="text-xs text-muted">{teamB.name} wins</div></div>
                </div>
              ) : <p className="text-center text-sm text-faint">No recorded meetings.</p>}
            </div>

            {/* Standings comparison */}
            {sa && sb && (
              <div className="p-6">
                <h3 className="text-sm font-medium text-muted text-center mb-3">
                  This Season{standingA?.competitionName ? ` · ${standingA.competitionName}` : ""}
                </h3>
                <StatRow label="League position" a={sa.position} b={sb.position} higherIsBetter={false} />
                <StatRow label="Points" a={sa.points} b={sb.points} />
                <StatRow label="Played" a={sa.played} b={sb.played} />
                <StatRow label="Won" a={sa.won} b={sb.won} />
                <StatRow label="Drawn" a={sa.drawn} b={sb.drawn} />
                <StatRow label="Lost" a={sa.lost} b={sb.lost} higherIsBetter={false} />
                <StatRow label="Goals for" a={sa.goalsFor} b={sb.goalsFor} />
                <StatRow label="Goals against" a={sa.goalsAgainst} b={sb.goalsAgainst} higherIsBetter={false} />
                <StatRow label="Goal difference" a={sa.goalDifference} b={sb.goalDifference} />
                <div className="flex items-center py-3">
                  <div className="flex-1"><FormPills form={sa.form} /></div>
                  <div className="w-36 text-center text-sm text-muted">Recent form</div>
                  <div className="flex-1"><FormPills form={sb.form} /></div>
                </div>
              </div>
            )}
          </div>

          {/* Recent meetings */}
          {h2h.length > 0 && (
            <div className="mt-6 bg-surface rounded-xl border border-line p-6">
              <h3 className="font-semibold text-ink mb-3">Recent meetings</h3>
              <div className="space-y-2">
                {h2h.map((m, i) => {
                  const aIsHome = m.homeTeamId === teamA.id;
                  const homeName = aIsHome ? teamA.name : teamB.name;
                  const awayName = aIsHome ? teamB.name : teamA.name;
                  const inner = (
                    <div className="flex items-center justify-between text-sm py-1.5">
                      <span className="text-muted">{format(new Date(m.scheduledAt), "d MMM yyyy")}</span>
                      <span className="text-ink">{homeName} <b>{m.homeScore}–{m.awayScore}</b> {awayName}</span>
                    </div>
                  );
                  return m.slug ? <Link key={i} href={`/matches/${m.slug}`} className="block hover:bg-surface-2 rounded px-2 -mx-2">{inner}</Link> : <div key={i}>{inner}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
