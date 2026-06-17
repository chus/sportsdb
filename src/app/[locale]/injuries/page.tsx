import { Link } from "@/i18n/navigation";
import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { getCurrentInjuries, getInjuryCount } from "@/lib/queries/injuries";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";
import { PageTracker } from "@/components/analytics/page-tracker";
import { localizedAlternates } from "@/lib/seo/hreflang";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  // Off-season the list can be empty — don't let an empty page get indexed
  // as thin content.
  const count = await getInjuryCount();
  return {
    title: "Football Injuries & Suspensions – Current Team News",
    description:
      "Live injury and suspension list across Europe's top leagues and the Americas — who's out, who's doubtful, and why, updated from official team news.",
    ...(count === 0 && { robots: { index: false, follow: true } }),
    alternates: localizedAlternates("/injuries"),
  };
}

function statusBadge(type: string | null): { label: string; cls: string } {
  if (type === "Questionable") return { label: "Doubtful", cls: "bg-amber-100 text-amber-800" };
  return { label: "Out", cls: "bg-red-100 text-red-700" };
}

export default async function InjuriesPage() {
  const injuries = await getCurrentInjuries();

  // Group by competition.
  const byComp = injuries.reduce((acc, inj) => {
    (acc[inj.competitionName] ??= []).push(inj);
    return acc;
  }, {} as Record<string, typeof injuries>);
  const comps = Object.keys(byComp).sort();

  const teamsAffected = new Set(injuries.map((i) => i.teamSlug)).size;

  return (
    <>
      <PageTracker />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Injuries", url: `${BASE_URL}/injuries` },
        ]}
      />
      <CollectionPageJsonLd
        name="Football Injuries & Suspensions"
        description="Current injury and suspension list across top football leagues."
        url={`${BASE_URL}/injuries`}
      />

      <div className="min-h-screen bg-surface-2">
        <PageHeader
          title="Injuries & Suspensions"
          subtitle="Who's out and who's doubtful across the major leagues"
          accentColor="bg-red-600"
          breadcrumbs={[{ label: "Home", href: "/" }, { label: "Injuries" }]}
          icon={<Activity className="w-7 h-7 text-faint" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            <div className="bg-surface rounded-xl border border-line p-4">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Players Out / Doubtful</div>
              <div className="text-2xl font-bold text-ink">{injuries.length}</div>
            </div>
            <div className="bg-surface rounded-xl border border-line p-4">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Teams Affected</div>
              <div className="text-2xl font-bold text-ink">{teamsAffected}</div>
            </div>
            <div className="bg-surface rounded-xl border border-line p-4">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Competitions</div>
              <div className="text-2xl font-bold text-ink">{comps.length}</div>
            </div>
          </div>

          {injuries.length === 0 ? (
            <div className="bg-surface rounded-xl border border-line p-10 text-center text-muted">
              No current injuries reported. Check back during the season for live team news.
            </div>
          ) : (
            <div className="space-y-8">
              {comps.map((comp) => {
                const list = byComp[comp];
                const compSlug = list[0]?.competitionSlug;
                return (
                  <section key={comp}>
                    <div className="flex items-center gap-3 mb-4">
                      {compSlug ? (
                        <Link href={`/competitions/${compSlug}`} className="text-xl font-bold text-ink hover:text-brand">
                          {comp}
                        </Link>
                      ) : (
                        <h2 className="text-xl font-bold text-ink">{comp}</h2>
                      )}
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink">
                        {list.length}
                      </span>
                    </div>
                    <div className="bg-surface rounded-xl border border-line overflow-hidden divide-y divide-line">
                      {list.map((inj, i) => {
                        const badge = statusBadge(inj.type);
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-3">
                            {inj.playerImage ? (
                              <img src={inj.playerImage} alt="" className="w-8 h-8 rounded-full object-cover bg-surface-2 shrink-0" />
                            ) : (
                              <span className="w-8 h-8 rounded-full bg-surface-2 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              {inj.isIndexable ? (
                                <Link href={`/players/${inj.playerSlug}`} className="font-medium text-ink hover:text-brand">
                                  {inj.playerName}
                                </Link>
                              ) : (
                                <span className="font-medium text-ink">{inj.playerName}</span>
                              )}
                              <div className="text-xs text-muted truncate">
                                <Link href={`/teams/${inj.teamSlug}`} className="hover:text-brand">{inj.teamName}</Link>
                                {inj.reason ? ` · ${inj.reason}` : ""}
                              </div>
                            </div>
                            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
