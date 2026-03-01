import Link from "next/link";
import { ArrowRightLeft, User, Shield, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getRecentTransfers } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { format } from "date-fns";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Football Transfers 2025/26 – Latest Signings | SportsDB",
  description:
    "Latest football transfers and signings for the 2025/26 season. Track player movements between clubs.",
  openGraph: {
    title: "Football Transfers 2025/26 – Latest Signings | SportsDB",
    description: "Latest football transfers and signings for the 2025/26 season.",
    url: `${BASE_URL}/transfers`,
  },
  alternates: {
    canonical: `${BASE_URL}/transfers`,
  },
};

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

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-4">
              <ArrowRightLeft className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">Transfers</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              Latest football transfers, signings, and player movements.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
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
                      <th className="px-4 py-3 font-medium">Player</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">From</th>
                      <th className="px-4 py-3 font-medium">To</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                      <th className="px-4 py-3 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/players/${transfer.player.slug}`}
                            className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              {transfer.player.imageUrl ? (
                                <img
                                  src={transfer.player.imageUrl}
                                  alt={transfer.player.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{transfer.player.name}</div>
                              <div className="text-xs text-neutral-500">{transfer.player.position}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {transfer.fromTeam ? (
                            <Link
                              href={`/teams/${transfer.fromTeam.slug}`}
                              className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                            >
                              {transfer.fromTeam.logoUrl ? (
                                <img src={transfer.fromTeam.logoUrl} alt={transfer.fromTeam.name} className="w-5 h-5 object-contain" />
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
                              <img src={transfer.toTeam.logoUrl} alt={transfer.toTeam.name} className="w-5 h-5 object-contain" />
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
