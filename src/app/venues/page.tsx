import Link from "next/link";
import { Building, MapPin, Users, Calendar } from "lucide-react";
import type { Metadata } from "next";
import { getAllVenues } from "@/lib/queries/venues";
import { BreadcrumbJsonLd, ItemListJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Football Stadiums & Venues – Capacity, Location & Info | DataSports",
  description: "Explore football stadiums and venues worldwide. Find capacity, location, opening year, and home teams for every major venue.",
  alternates: { canonical: `${BASE_URL}/venues` },
};

export default async function VenuesPage() {
  const venues = await getAllVenues();

  // Calculate summary stats
  const totalVenues = venues.length;
  const totalCapacity = venues.reduce((sum, v) => sum + (v.capacity ?? 0), 0);
  const countries = [...new Set(venues.map((v) => v.country).filter(Boolean))];
  const countriesCount = countries.length;
  const oldestVenue = venues
    .filter((v) => v.openedYear)
    .sort((a, b) => (a.openedYear ?? 0) - (b.openedYear ?? 0))[0];

  // Group venues by country
  const venuesByCountry = venues.reduce((acc, venue) => {
    const country = venue.country || "Unknown";
    if (!acc[country]) {
      acc[country] = [];
    }
    acc[country].push(venue);
    return acc;
  }, {} as Record<string, typeof venues>);

  // Sort countries alphabetically
  const sortedCountries = Object.keys(venuesByCountry).sort();

  // Top 50 venues by capacity for ItemListJsonLd
  const top50ByCapacity = [...venues]
    .filter((v) => v.capacity)
    .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0))
    .slice(0, 50);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Venues", url: `${BASE_URL}/venues` },
        ]}
      />
      <CollectionPageJsonLd name="Football Stadiums & Venues" description="Explore football stadiums and venues worldwide. Find capacity, location, and home teams." url={`${BASE_URL}/venues`} />
      <ItemListJsonLd
        name="Top Football Stadiums by Capacity"
        items={top50ByCapacity.map((v, i) => ({
          position: i + 1,
          url: `${BASE_URL}/venues/${v.slug}`,
          name: v.name,
          image: v.imageUrl,
        }))}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Stadiums & Venues"
          subtitle="Explore football stadiums worldwide"
          accentColor="bg-neutral-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Venues" },
          ]}
          icon={<Building className="w-7 h-7 text-neutral-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Total Venues</div>
              <div className="text-2xl font-bold text-neutral-900">{totalVenues}</div>
              <div className="text-xs text-neutral-500">stadiums tracked</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Total Capacity</div>
              <div className="text-2xl font-bold text-neutral-900">{(totalCapacity / 1000000).toFixed(1)}M</div>
              <div className="text-xs text-neutral-500">combined seats</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Countries</div>
              <div className="text-2xl font-bold text-neutral-900">{countriesCount}</div>
              <div className="text-xs text-neutral-500">worldwide</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Oldest Venue</div>
              <div className="text-2xl font-bold text-neutral-900">{oldestVenue?.openedYear ?? "N/A"}</div>
              <div className="text-xs text-neutral-500">{oldestVenue?.name.split(" ").slice(0, 2).join(" ")}</div>
            </div>
          </div>

          {/* Venues by Country */}
          <div className="space-y-8">
            {sortedCountries.map((country) => {
              const countryVenues = venuesByCountry[country];
              return (
                <section key={country}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold text-neutral-900">{country}</h2>
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                      {countryVenues.length}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {countryVenues.map((venue) => (
                      <Link
                        key={venue.id}
                        href={`/venues/${venue.slug}`}
                        className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="font-medium text-neutral-900 mb-2">{venue.name}</div>
                        <div className="space-y-1">
                          {venue.city && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              <MapPin className="w-3.5 h-3.5" />
                              {venue.city}
                            </div>
                          )}
                          {venue.capacity && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              <Users className="w-3.5 h-3.5" />
                              {venue.capacity.toLocaleString()} capacity
                            </div>
                          )}
                          {venue.openedYear && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              <Calendar className="w-3.5 h-3.5" />
                              Opened {venue.openedYear}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
