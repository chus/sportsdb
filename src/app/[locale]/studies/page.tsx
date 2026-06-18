import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { BarChart3, ChevronRight } from "lucide-react";
import { listStudies } from "@/lib/queries/studies";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { localizedAlternates } from "@/lib/seo/hreflang";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const title = "Football Data Studies — Original Rankings & Stats";
  const description =
    "Original, data-driven football rankings updated weekly: top scorers, assist leaders, goals per 90, disciplinary records and more. Free to cite with attribution.";
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/studies`, siteName: "DataSports", type: "website" },
    alternates: localizedAlternates("/studies"),
  };
}

export default async function StudiesPage() {
  const studies = await listStudies();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Data Studies", url: `${BASE_URL}/studies` },
        ]}
      />
      <PageTracker />
      <div className="min-h-screen bg-surface-2">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            <h1 className="text-3xl font-bold text-ink">Football Data Studies</h1>
          </div>
          <p className="text-muted mb-8 max-w-2xl">
            Original, data-driven rankings built from our season statistics and refreshed weekly.
            Free to cite with attribution to DataSports.
          </p>

          {studies.length === 0 ? (
            <p className="text-muted">New studies are generated each week — check back soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {studies.map((s) => (
                <Link
                  key={s.slug}
                  href={`/studies/${s.slug}`}
                  className="block bg-surface rounded-xl border border-line p-5 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-ink">{s.title}</h2>
                      <p className="text-sm text-muted mt-1">{s.dek}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-faint shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
