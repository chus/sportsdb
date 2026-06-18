import type { Metadata } from "next";
import { TrendingUp, TrendingDown, Gem, Flame, CalendarCheck } from "lucide-react";
import { getFplData, type FplPlayer } from "@/lib/fpl/compute";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { localizedAlternates } from "@/lib/seo/hreflang";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const title = "FPL Tools — Value Picks, Form, Price Changes & Fixtures";
  const description =
    "Free Fantasy Premier League tools: best value players by points per million, in-form picks, daily price risers and fallers, and the easiest upcoming fixtures by difficulty.";
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/fpl`, siteName: "DataSports", type: "website" },
    alternates: localizedAlternates("/fpl"),
  };
}

function PlayerTable({ players, metric, metricLabel }: { players: FplPlayer[]; metric: (p: FplPlayer) => string; metricLabel: string }) {
  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-muted">
            <th className="text-left font-medium px-3 py-2">Player</th>
            <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Team</th>
            <th className="text-right font-medium px-3 py-2">£m</th>
            <th className="text-right font-medium px-3 py-2">Pts</th>
            <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={`${p.name}-${i}`} className="border-b border-line last:border-0">
              <td className="px-3 py-2 font-medium text-ink">{p.name} <span className="text-faint text-xs">{p.position}</span></td>
              <td className="px-3 py-2 text-muted hidden sm:table-cell">{p.team}</td>
              <td className="px-3 py-2 text-right text-muted">{p.price.toFixed(1)}</td>
              <td className="px-3 py-2 text-right text-muted">{p.points}</td>
              <td className="px-3 py-2 text-right font-semibold text-ink">{metric(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-ink">{title}</h2>
      </div>
      <p className="text-sm text-muted mb-3">{subtitle}</p>
      {children}
    </section>
  );
}

export default async function FplPage() {
  const data = await getFplData();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "FPL Tools", url: `${BASE_URL}/fpl` },
        ]}
      />
      <PageTracker />
      <div className="min-h-screen bg-surface-2">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="text-3xl font-bold text-ink mb-1">Fantasy Premier League Tools</h1>
          <p className="text-muted mb-8">
            Value picks, form, price changes and fixture difficulty — updated through the season.
            {data.nextGameweek ? ` Fixtures from GW${data.nextGameweek}.` : ""}
          </p>

          {!data.available ? (
            <p className="text-muted">FPL data is temporarily unavailable. Please check back shortly.</p>
          ) : (
            <>
              {data.valuePicks.length > 0 && (
                <Section icon={Gem} title="Best Value" subtitle="Most points per £m — the squad-builders' edge.">
                  <PlayerTable players={data.valuePicks} metric={(p) => p.ppm.toFixed(1)} metricLabel="Pts/£m" />
                </Section>
              )}

              {data.inForm.length > 0 && (
                <Section icon={Flame} title="In Form" subtitle="Highest form rating right now (available players).">
                  <PlayerTable players={data.inForm} metric={(p) => p.form.toFixed(1)} metricLabel="Form" />
                </Section>
              )}

              {(data.risers.length > 0 || data.fallers.length > 0) && (
                <div className="grid md:grid-cols-2 gap-6">
                  {data.risers.length > 0 && (
                    <Section icon={TrendingUp} title="Price Risers" subtitle="Biggest price rises this gameweek.">
                      <PlayerTable players={data.risers} metric={(p) => `+${p.priceChangeEvent.toFixed(1)}`} metricLabel="Δ £m" />
                    </Section>
                  )}
                  {data.fallers.length > 0 && (
                    <Section icon={TrendingDown} title="Price Fallers" subtitle="Biggest price drops this gameweek.">
                      <PlayerTable players={data.fallers} metric={(p) => p.priceChangeEvent.toFixed(1)} metricLabel="Δ £m" />
                    </Section>
                  )}
                </div>
              )}

              {data.easiestFixtures.length > 0 && (
                <Section icon={CalendarCheck} title="Easiest Fixtures" subtitle="Teams ranked by average fixture difficulty over the next 5 gameweeks (lower is easier).">
                  <div className="bg-surface rounded-xl border border-line overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line bg-surface-2 text-muted">
                          <th className="text-left font-medium px-3 py-2">Team</th>
                          <th className="text-right font-medium px-3 py-2">Avg FDR</th>
                          <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Next 5</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.easiestFixtures.slice(0, 20).map((t) => (
                          <tr key={t.shortName} className="border-b border-line last:border-0">
                            <td className="px-3 py-2 font-medium text-ink">{t.team}</td>
                            <td className="px-3 py-2 text-right font-semibold text-ink">{t.avgDifficulty.toFixed(1)}</td>
                            <td className="px-3 py-2 hidden sm:table-cell">
                              <div className="flex gap-1">
                                {t.fixtures.map((f, i) => (
                                  <span
                                    key={i}
                                    title={`${f.opponent} (${f.home ? "H" : "A"}) — difficulty ${f.difficulty}`}
                                    className={`inline-block w-7 text-center text-xs rounded px-1 py-0.5 ${
                                      f.difficulty <= 2 ? "bg-green-100 text-green-700" : f.difficulty === 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {f.opponent}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              <p className="text-xs text-faint mt-4">
                Data from the official Fantasy Premier League API. Not affiliated with the Premier League or FPL.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
