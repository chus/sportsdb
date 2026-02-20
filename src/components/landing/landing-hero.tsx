import { Trophy } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";

export function LandingHero() {
  return (
    <section className="relative pt-16 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 opacity-5" />

      <div className="max-w-5xl mx-auto px-4 relative">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6">
            <Trophy className="w-4 h-4" />
            The IMDb of Sports
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-neutral-900 mb-4 leading-tight">
            Your Personal
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Sports Universe
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Search players, teams, and competitions. Get personalized updates
            from the world's most comprehensive sports database.
          </p>

          {/* Prominent Search Bar */}
          <div className="max-w-2xl mx-auto">
            <SearchBar
              size="large"
              placeholder="Search for Messi, Barcelona, Premier League..."
              autoFocus={false}
            />
            <p className="text-sm text-neutral-500 mt-3">
              Try: <span className="text-blue-600 font-medium">Messi</span>, <span className="text-blue-600 font-medium">Real Madrid</span>, <span className="text-blue-600 font-medium">Champions League</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
