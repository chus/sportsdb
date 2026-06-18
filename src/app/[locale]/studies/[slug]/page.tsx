import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { BarChart3 } from "lucide-react";
import { getStudyBySlug, listStudies } from "@/lib/queries/studies";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/json-ld";
import { localizedAlternates } from "@/lib/seo/hreflang";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const studies = await listStudies();
  return studies.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = await getStudyBySlug(slug);
  if (!study) return {};
  const description = `${study.dek} Original DataSports ranking, free to cite with attribution.`;
  return {
    title: `${study.title} — DataSports Study`,
    description,
    openGraph: {
      title: study.title,
      description,
      url: `${BASE_URL}/studies/${slug}`,
      siteName: "DataSports",
      type: "article",
    },
    alternates: localizedAlternates(`/studies/${slug}`),
  };
}

export default async function StudyPage({ params }: PageProps) {
  const { slug } = await params;
  const study = await getStudyBySlug(slug);
  if (!study) notFound();

  const { columns, rows, methodology, seasonLabel, generatedAt } = study.data;
  const updated = generatedAt ? format(new Date(generatedAt), "d MMMM yyyy") : null;
  const citation = `${study.title} — DataSports (${BASE_URL}/studies/${slug})`;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Data Studies", url: `${BASE_URL}/studies` },
          { name: study.title, url: `${BASE_URL}/studies/${slug}` },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: study.title,
          description: study.dek,
          url: `${BASE_URL}/studies/${slug}`,
          creator: { "@type": "Organization", name: "DataSports", url: BASE_URL },
          ...(generatedAt && { dateModified: generatedAt }),
          isAccessibleForFree: true,
          license: "https://creativecommons.org/licenses/by/4.0/",
        }}
      />
      <PageTracker />

      <div className="min-h-screen bg-surface-2">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <Link href="/studies" className="inline-flex items-center gap-2 text-muted hover:text-ink mb-4">
            &larr; All studies
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-6 h-6 text-blue-600 shrink-0" />
            <h1 className="text-3xl font-bold text-ink">{study.title}</h1>
          </div>
          <p className="text-muted mb-1">{study.dek}</p>
          <p className="text-sm text-faint mb-6">
            {seasonLabel} season{updated ? ` · Updated ${updated}` : ""}
          </p>

          <div className="bg-surface rounded-xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-muted">
                  <th className="text-left font-medium px-4 py-3 w-10">#</th>
                  <th className="text-left font-medium px-4 py-3">Player</th>
                  <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Team</th>
                  {columns.map((c) => (
                    <th key={c.key} className="text-right font-medium px-4 py-3 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rank} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-faint">{r.rank}</td>
                    <td className="px-4 py-3">
                      <Link href={`/players/${r.slug}`} className="font-medium text-ink hover:text-blue-600">
                        {r.player}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell">
                      {r.team && r.teamSlug ? (
                        <Link href={`/teams/${r.teamSlug}`} className="hover:text-blue-600">{r.team}</Link>
                      ) : (
                        r.team ?? "—"
                      )}
                    </td>
                    {columns.map((c, i) => (
                      <td key={c.key} className={`px-4 py-3 text-right ${i === 0 ? "font-semibold text-ink" : "text-muted"}`}>
                        {r.values[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-surface rounded-xl border border-line p-5">
            <h2 className="font-semibold text-ink mb-1">Methodology</h2>
            <p className="text-sm text-muted">{methodology}</p>
          </div>

          <div className="mt-4 bg-surface rounded-xl border border-line p-5">
            <h2 className="font-semibold text-ink mb-1">Cite this study</h2>
            <p className="text-sm text-muted mb-2">
              This data is free to use in articles and reports with attribution to DataSports.
            </p>
            <code className="block text-xs bg-surface-2 rounded-lg p-3 text-ink break-words">{citation}</code>
          </div>
        </div>
      </div>
    </>
  );
}
