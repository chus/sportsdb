import { Suspense } from "react";
import Link from "next/link";
import { Users, Shield, Trophy, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { searchEntities } from "@/lib/queries/search";
import { SearchBar } from "@/components/search/search-bar";
import type { SearchResult } from "@/types/entities";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q || "";

  return {
    title: query ? `Search: ${query}` : "Search",
    description: query
      ? `Search results for "${query}" - Find players, teams, competitions, and venues`
      : "Search players, teams, competitions, and venues in SportsDB",
  };
}

const ENTITY_TYPES = [
  { value: "", label: "All", icon: null },
  { value: "player", label: "Players", icon: Users },
  { value: "team", label: "Teams", icon: Shield },
  { value: "competition", label: "Competitions", icon: Trophy },
  { value: "venue", label: "Venues", icon: MapPin },
];

const ENTITY_ROUTES: Record<string, string> = {
  player: "/players",
  team: "/teams",
  competition: "/competitions",
  venue: "/venues",
};

const TYPE_COLORS: Record<string, string> = {
  player: "bg-blue-100 text-blue-700",
  team: "bg-green-100 text-green-700",
  competition: "bg-purple-100 text-purple-700",
  venue: "bg-orange-100 text-orange-700",
};

const TYPE_LABELS: Record<string, string> = {
  player: "Player",
  team: "Team",
  competition: "Competition",
  venue: "Venue",
};

function SearchResultCard({ result }: { result: SearchResult }) {
  const href = `${ENTITY_ROUTES[result.entityType]}/${result.slug}`;
  const Icon =
    ENTITY_TYPES.find((t) => t.value === result.entityType)?.icon || Users;

  return (
    <Link
      href={href}
      className="block p-4 bg-white border border-neutral-200 rounded-xl hover:shadow-lg hover:border-blue-200 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
          <Icon className="w-6 h-6 text-neutral-500 group-hover:text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
              {result.name}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${TYPE_COLORS[result.entityType]}`}
            >
              {TYPE_LABELS[result.entityType]}
            </span>
          </div>
          {result.subtitle && (
            <p className="text-sm text-neutral-600 truncate">{result.subtitle}</p>
          )}
          {result.meta && (
            <p className="text-xs text-neutral-500 mt-1">{result.meta}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

async function SearchResults({
  query,
  type,
}: {
  query: string;
  type?: string;
}) {
  if (!query) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">
          Start searching
        </h2>
        <p className="text-neutral-500">
          Enter a query above to find players, teams, competitions, and venues.
        </p>
      </div>
    );
  }

  const results = await searchEntities(query, type || undefined, 50);

  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">
          No results found
        </h2>
        <p className="text-neutral-500">
          No matches for "{query}"{type ? ` in ${TYPE_LABELS[type] || type}s` : ""}.
          Try adjusting your search.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
        {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
        {type ? ` in ${TYPE_LABELS[type] || type}s` : ""}
      </p>
      <div className="grid gap-3">
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function SearchResultsSkeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-4 bg-white border border-neutral-200 rounded-xl animate-pulse"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-neutral-200 rounded-lg" />
            <div className="flex-1">
              <div className="h-5 bg-neutral-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-neutral-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const type = params.type || "";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-6">Search</h1>
        <SearchBar initialQuery={query} autoFocus={!query} />
      </div>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ENTITY_TYPES.map((entityType) => {
          const isActive = type === entityType.value;
          const Icon = entityType.icon;
          const href = query
            ? `/search?q=${encodeURIComponent(query)}${entityType.value ? `&type=${entityType.value}` : ""}`
            : `/search${entityType.value ? `?type=${entityType.value}` : ""}`;

          return (
            <Link
              key={entityType.value}
              href={href}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {entityType.label}
            </Link>
          );
        })}
      </div>

      {/* Results */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchResults query={query} type={type} />
      </Suspense>
    </div>
  );
}
