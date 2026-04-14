import Link from "next/link";
import { ArrowRightLeft, User, Shield, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getRecentTransfers, getCurrentSeasonLabel } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, CollectionPageJsonLd, ItemListJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PlayerLink } from "@/components/player/player-link";
import { PageHeader } from "@/components/layout/page-header";
import { PageTracker } from "@/components/analytics/page-tracker";
import { format } from "date-fns";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const sl = await getCurrentSeasonLabel();
  const title = `Football Transfers ${sl} – Latest Signings | DataSports`;
  const description = `Latest football transfers and signings for the ${sl} season. Track player movements between clubs.`;
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/transfers`, siteName: "DataSports", type: "website" },
    alternates: { canonical: `${BASE_URL}/transfers` },
  };
}

export default async function TransfersPage() {
  const transfers = await getRecentTransfers(50);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Transfers", url: `${BASE_URL}/transfers` },
        ]}
      />
      <CollectionPageJsonLd
        name="Football Transfers"
        description="Latest football transfers, signings, and player movements between clubs"
        url={`${BASE_URL}/transfers`}
      />
      <PageTracker />
      {transfers.length > 0 && (
        <ItemListJsonLd
          name="Recent Football Transfers"
          items={transfers.slice(0, 20).map((t, i) => ({
            position: i + 1,
            url: `${BASE_URL}/players/${t.player.slug}`,
            name: `${t.player.name} → ${t.toTeam.name}`,
          }))}
        />
      )}

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Transfers"
          subtitle="Latest football transfers, signings, and player movements"
          accentColor="bg-emerald-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Transfers" },
          ]}
          icon={<ArrowRightLeft className="w-7 h-7 text-emerald-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Transfer Summary Stats */}
          {transfers.length > 0 && (() => {
            const buyCount: Record<string, number> = {};
            const sellCount: Record<string, number> = {};
            for (const t of transfers) {
              buyCount[t.toTeam.name] = (buyCount[t.toTeam.name] || 0) + 1;
              if (t.fromTeam) sellCount[t.fromTeam.name] = (sellCount[t.fromTeam.name] || 0) + 1;
            }
            const topBuyer = Object.entries(buyCount).sort((a, b) => b[1] - a[1])[0];
            const topSeller = Object.entries(sellCount).sort((a, b) => b[1] - a[1])[0];
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Total Transfers</div>
                  <div className="text-2xl font-bold text-neutral-900">{transfers.length}</div>
                  <div className="text-xs text-neutral-500">player movements</div>
                </div>
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Most Active Buyer</div>
                  <div className="text-lg font-bold text-neutral-900 truncate">{topBuyer?.[0] ?? "—"}</div>
                  <div className="text-xs text-neutral-500">{topBuyer?.[1] ?? 0} signings</div>
                </div>
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Most Active Seller</div>
                  <div className="text-lg font-bold text-neutral-900 truncate">{topSeller?.[0] ?? "—"}</div>
                  <div className="text-xs text-neutral-500">{topSeller?.[1] ?? 0} departures</div>
                </div>
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Latest Transfer</div>
                  <div className="text-lg font-bold text-neutral-900 truncate">{transfers[0].player.name}</div>
                  <div className="text-xs text-neutral-500">to {transfers[0].toTeam.name}</div>
                </div>
              </div>
            );
          })()}

          {transfers.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
              <ArrowRightLeft className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neutral-900 mb-2">No transfer data yet</h2>
              <p className="text-neutral-500">
                Transfer information will appear as player movements are recorded.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                      <th scope="col" className="px-4 py-3 font-medium">Player</th>
                      <th scope="col" className="px-4 py-3 font-medium hidden md:table-cell">From</th>
                      <th scope="col" className="px-4 py-3 font-medium">To</th>
                      <th scope="col" className="px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3">
                          <PlayerLink
                            slug={transfer.player.slug}
                            isLinkWorthy={transfer.player.isIndexable ?? false}
                            className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              {transfer.player.imageUrl ? (
                                <ImageWithFallback
                                  src={transfer.player.imageUrl}
                                  alt={transfer.player.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                  width={32}
                                  height={32}
                                />
                              ) : (
                                <User className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{transfer.player.name}</div>
                              <div className="text-xs text-neutral-500">{transfer.player.position}</div>
                            </div>
                          </PlayerLink>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {transfer.fromTeam ? (
                            <Link
                              href={`/teams/${transfer.fromTeam.slug}`}
                              className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                            >
                              {transfer.fromTeam.logoUrl ? (
                                <ImageWithFallback src={transfer.fromTeam.logoUrl} alt={transfer.fromTeam.name} className="w-5 h-5 object-contain" width={20} height={20} />
                              ) : (
                                <Shield className="w-4 h-4 text-neutral-300" />
                              )}
                              <span className="text-sm">{transfer.fromTeam.name}</span>
                            </Link>
                          ) : (
                            <span className="text-sm text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/teams/${transfer.toTeam.slug}`}
                            className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                          >
                            {transfer.toTeam.logoUrl ? (
                              <ImageWithFallback src={transfer.toTeam.logoUrl} alt={transfer.toTeam.name} className="w-5 h-5 object-contain" width={20} height={20} />
                            ) : (
                              <Shield className="w-4 h-4 text-neutral-300" />
                            )}
                            <span className="text-sm">{transfer.toTeam.name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {transfer.transferType ? (
                            <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded capitalize">
                              {transfer.transferType}
                            </span>
                          ) : (
                            <span className="text-sm text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-neutral-500">
                          {format(new Date(transfer.date), "MMM d, yyyy")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
