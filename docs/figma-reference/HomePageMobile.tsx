import { Search, Trophy, Menu, X } from "lucide-react";
import { useState } from "react";
import { SearchBar } from "../SearchBar";
import { LiveMatchCard } from "../LiveMatchCard";
import { PlayerCard } from "../PlayerCard";
import { TeamCard } from "../TeamCard";
import { MomentCard } from "../MomentCard";

interface HomePageMobileProps {
  onSearch: (query: string) => void;
  onNavigate: (page: string, id?: string) => void;
}

export function HomePageMobile({ onSearch, onNavigate }: HomePageMobileProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Mobile Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => onNavigate("home")}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                SportsDB
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-neutral-100 rounded-lg">
                <Search className="w-5 h-5 text-neutral-600" />
              </button>
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                {menuOpen ? (
                  <X className="w-5 h-5 text-neutral-600" />
                ) : (
                  <Menu className="w-5 h-5 text-neutral-600" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {menuOpen && (
            <div className="pt-4 pb-2 space-y-1">
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                Players
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                Teams
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                Competitions
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                Matches
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - Mobile Optimized */}
      <section className="relative h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1767916732786-a83902ffc25c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMHN0YWRpdW0lMjBjcm93ZCUyMGNoYW1waW9ucyUyMGxlYWd1ZXxlbnwxfHx8fDE3NzA4MTU2MDJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Stadium"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>

        <div className="relative h-full px-4 flex flex-col justify-end pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-full mb-4 self-start">
            <span className="text-xs font-semibold text-blue-100">Featured Match</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
            Champions League
            <span className="block text-blue-400">Final 2026</span>
          </h1>

          <p className="text-white/90 mb-4 text-sm leading-relaxed">
            Manchester City face Real Madrid in the most anticipated match of the season.
          </p>

          <div className="mb-4">
            <SearchBar 
              onSearch={onSearch}
              onResultClick={(result) => {
                if (result.type === "player") onNavigate("player", result.id);
                if (result.type === "team") onNavigate("team", result.id);
                if (result.type === "match") onNavigate("match", result.id);
              }}
              placeholder="Search..."
            />
          </div>

          <button 
            onClick={() => onNavigate("match", "1")}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg text-sm"
          >
            View Match Details
          </button>
        </div>
      </section>

      {/* Live Now Section */}
      <section className="py-8 bg-neutral-900 text-white">
        <div className="px-4">
          <h2 className="text-xl font-bold mb-4">Live Now & Upcoming</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
            <LiveMatchCard
              homeTeam="Man City"
              awayTeam="Liverpool"
              homeScore={2}
              awayScore={1}
              status="live"
              minute="67"
              competition="Premier League"
              onClick={() => onNavigate("match", "1")}
            />
            <LiveMatchCard
              homeTeam="Real Madrid"
              awayTeam="Barcelona"
              status="upcoming"
              time="19:30"
              competition="La Liga"
              onClick={() => onNavigate("match", "2")}
            />
          </div>
        </div>
      </section>

      {/* Trending Players */}
      <section className="py-8">
        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-neutral-900">Trending Players</h2>
            <button className="text-sm font-medium text-blue-600">See all</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PlayerCard
              name="E. Haaland"
              position="Forward"
              team="Man City"
              imageUrl="https://images.unsplash.com/photo-1685944505412-c12c8bc14e60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlcmxpbmclMjBoYWFsYW5kJTIwY2VsZWJyYXRpb24lMjBhY3Rpb258ZW58MXx8fHwxNzcwODE1NjAyfDA&ixlib=rb-4.1.0&q=80&w=1080"
              trending
              stats="32 goals"
              onClick={() => onNavigate("player", "1")}
            />
            <PlayerCard
              name="K. Mbappé"
              position="Forward"
              team="Real Madrid"
              imageUrl="https://images.unsplash.com/photo-1538070665336-302187b783b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW5pY2l1cyUyMGp1bmlvciUyMGZvb3RiYWxsJTIwYWN0aW9ufGVufDF8fHx8MTc3MDgxNTYwM3ww&ixlib=rb-4.1.0&q=80&w=1080"
              trending
              stats="28 goals"
              onClick={() => onNavigate("player", "2")}
            />
          </div>
        </div>
      </section>

      {/* Featured Moments */}
      <section className="py-8 bg-neutral-50">
        <div className="px-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">Featured Moments</h2>
          <div className="space-y-4">
            <MomentCard
              title="Champions League Final"
              description="The ultimate showdown between Europe's elite clubs"
              imageUrl="https://images.unsplash.com/photo-1759446334429-bb1f2d1d9f13?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGFtcGlvbnMlMjBsZWFndWUlMjB0cm9waHklMjBjZWxlYnJhdGlvbnxlbnwxfHx8fDE3NzA4MTU2MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
              label="Champions League"
              onClick={() => onNavigate("match", "1")}
            />
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="py-12 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">World's Sports Database</h2>
            <p className="text-blue-100">Updated daily</p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">250K+</div>
              <div className="text-blue-200 text-sm">Players</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">15K+</div>
              <div className="text-blue-200 text-sm">Teams</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">500+</div>
              <div className="text-blue-200 text-sm">Competitions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">2M+</div>
              <div className="text-blue-200 text-sm">Matches</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
