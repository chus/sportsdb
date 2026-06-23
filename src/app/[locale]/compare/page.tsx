import { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Shield } from "lucide-react";
import { ComparePageContent } from "./compare-content";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { localizedAlternates } from "@/lib/seo/hreflang";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { compareMatchup } from "@/lib/seo/compare";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

/** A handful of featured same-league team pairs for the hub's internal links. */
async function getFeaturedTeamPairs(): Promise<{ a: string; an: string; b: string; bn: string }[]> {
  const rows =
    ((await db.execute(sql`
      SELECT t.slug, t.name, cs.competition_id AS comp
      FROM standings s
      JOIN competition_seasons cs ON cs.id = s.competition_season_id
      JOIN seasons se ON se.id = cs.season_id AND se.is_current = true
      JOIN teams t ON t.id = s.team_id
      WHERE s.position <= 2 AND s."group" = ''
      ORDER BY cs.competition_id, s.position
    `)) as unknown as { rows?: { slug: string; name: string; comp: string }[] }).rows ?? [];
  const byComp = new Map<string, { slug: string; name: string }[]>();
  for (const r of rows) (byComp.get(r.comp) ?? byComp.set(r.comp, []).get(r.comp)!).push(r);
  const pairs: { a: string; an: string; b: string; bn: string }[] = [];
  for (const g of byComp.values()) if (g.length >= 2) pairs.push({ a: g[0].slug, an: g[0].name, b: g[1].slug, bn: g[1].name });
  return pairs.slice(0, 8);
}

export const metadata: Metadata = {
  title: "Compare Players – Side-by-Side Stats",
  description:
    "Compare football players side by side. Goals, assists, appearances, and career statistics head-to-head.",
  openGraph: {
    title: "Compare Players – Side-by-Side Stats",
    description:
      "Compare football players side by side. Goals, assists, appearances, and career statistics head-to-head.",
    url: `${BASE_URL}/compare`,
  },
  alternates: localizedAlternates("/compare"),
};

export default async function ComparePage() {
  const teamPairs = await getFeaturedTeamPairs();
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Compare Players", url: `${BASE_URL}/compare` },
        ]}
      />
      <ComparePageContent />

      {teamPairs.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-ink">Compare teams head-to-head</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {teamPairs.map((p) => (
              <Link
                key={`${p.a}-${p.b}`}
                href={`/compare/teams/${compareMatchup(p.a, p.b)}`}
                className="block bg-surface rounded-xl border border-line p-4 hover:shadow-xl transition-shadow text-sm font-medium text-ink"
              >
                {p.an} <span className="text-faint">vs</span> {p.bn}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
