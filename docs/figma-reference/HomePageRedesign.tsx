import { Search, Trophy, Users, Activity, TrendingUp, Clock, Sparkles, Database, Globe, RefreshCw, ChevronRight } from "lucide-react";
import { useState } from "react";
import { SearchBar } from "../SearchBar";
import { LiveMatchCard } from "../LiveMatchCard";
import { PlayerCard } from "../PlayerCard";
import { TeamCard } from "../TeamCard";
import { MomentCard } from "../MomentCard";

interface HomePageRedesignProps {
  onSearch: (query: string) => void;
  onNavigate: (page: string, id?: string) => void;
}

export function HomePageRedesign({ onSearch, onNavigate }: HomePageRedesignProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Navigation Bar - More expressive */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <button 
              onClick={() => onNavigate("home")}
              className="flex items-center gap-3 group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  SportsDB
                </div>
                <div className="text-xs text-neutral-500 -mt-0.5">International Sports Database</div>
              </div>
            </button>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              <button className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                Players
              </button>
              <button className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                Teams
              </button>
              <button className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                Competitions
              </button>
              <button className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                Matches
              </button>
            </div>

            {/* Search Icon */}
            <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <Search className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Visual Spotlight */}
      <section className="relative h-[600px] overflow-hidden">
        {/* Background Image with overlay */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1767916732786-a83902ffc25c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMHN0YWRpdW0lMjBjcm93ZCUyMGNoYW1waW9ucyUyMGxlYWd1ZXxlbnwxfHx8fDE3NzA4MTU2MDJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Stadium"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-center">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-sm font-semibold text-blue-100">Featured Match</span>
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Champions League
              <span className="block text-blue-400">Final 2026</span>
            </h1>

            {/* Description */}
            <p className="text-xl text-white/90 mb-8 max-w-2xl leading-relaxed">
              Manchester City face Real Madrid in the most anticipated match of the season. 
              Explore lineups, stats, and the road to the final.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mb-6">
              <SearchBar 
                onSearch={onSearch}
                onResultClick={(result) => {
                  if (result.type === "player") onNavigate("player", result.id);
                  if (result.type === "team") onNavigate("team", result.id);
                  if (result.type === "match") onNavigate("match", result.id);
                }}
                placeholder="Search players, teams, matches, competitions..."
              />
            </div>

            {/* CTA */}
            <button 
              onClick={() => onNavigate("match", "1")}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              View Match Details
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Live Now Section */}
      <section className="py-12 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-red-500" />
              <h2 className="text-2xl font-bold">Live Now & Upcoming</h2>
            </div>
            <button className="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all matches
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Horizontal scrollable */}
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
            <LiveMatchCard
              homeTeam="Manchester City"
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
              homeScore={1}
              awayScore={1}
              status="live"
              minute="82"
              competition="La Liga"
              onClick={() => onNavigate("match", "2")}
            />
            <LiveMatchCard
              homeTeam="Bayern Munich"
              awayTeam="Dortmund"
              status="upcoming"
              time="19:30"
              competition="Bundesliga"
              onClick={() => onNavigate("match", "3")}
            />
            <LiveMatchCard
              homeTeam="PSG"
              awayTeam="Marseille"
              homeScore={3}
              awayScore={0}
              status="finished"
              competition="Ligue 1"
              onClick={() => onNavigate("match", "4")}
            />
            <LiveMatchCard
              homeTeam="Arsenal"
              awayTeam="Chelsea"
              status="upcoming"
              time="21:00"
              competition="Premier League"
              onClick={() => onNavigate("match", "5")}
            />
          </div>
        </div>
      </section>

      {/* Trending Players Section - Visual Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-orange-500" />
                <h2 className="text-3xl font-bold text-neutral-900">Trending Players</h2>
              </div>
              <p className="text-neutral-600">Most searched this week</p>
            </div>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              See all
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <PlayerCard
              name="Erling Haaland"
              position="Forward"
              team="Manchester City"
              imageUrl="https://images.unsplash.com/photo-1685944505412-c12c8bc14e60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlcmxpbmclMjBoYWFsYW5kJTIwY2VsZWJyYXRpb24lMjBhY3Rpb258ZW58MXx8fHwxNzcwODE1NjAyfDA&ixlib=rb-4.1.0&q=80&w=1080"
              trending
              stats="32 goals"
              onClick={() => onNavigate("player", "1")}
            />
            <PlayerCard
              name="Kylian Mbappé"
              position="Forward"
              team="Real Madrid"
              imageUrl="https://images.unsplash.com/photo-1538070665336-302187b783b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW5pY2l1cyUyMGp1bmlvciUyMGZvb3RiYWxsJTIwYWN0aW9ufGVufDF8fHx8MTc3MDgxNTYwM3ww&ixlib=rb-4.1.0&q=80&w=1080"
              trending
              stats="28 goals"
              onClick={() => onNavigate("player", "2")}
            />
            <PlayerCard
              name="Vinicius Junior"
              position="Winger"
              team="Real Madrid"
              imageUrl="https://images.unsplash.com/photo-1752614654887-0b8d59c076b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb2NjZXIlMjBwbGF5ZXIlMjBkcmliYmxpbmclMjBhY3Rpb258ZW58MXx8fHwxNzcwODE1NjA3fDA&ixlib=rb-4.1.0&q=80&w=1080"
              stats="18 goals"
              onClick={() => onNavigate("player", "3")}
            />
            <PlayerCard
              name="Phil Foden"
              position="Midfielder"
              team="Manchester City"
              imageUrl="https://images.unsplash.com/photo-1671245166799-9639823eb9b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMGdvYWxrZWVwZXIlMjBzYXZlfGVufDF8fHx8MTc3MDgxNTYwN3ww&ixlib=rb-4.1.0&q=80&w=1080"
              stats="15 goals"
              onClick={() => onNavigate("player", "4")}
            />
          </div>
        </div>
      </section>

      {/* Featured Moments Section */}
      <section className="py-16 bg-gradient-to-b from-neutral-50 to-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-yellow-500" />
              <h2 className="text-3xl font-bold text-neutral-900">Featured Moments</h2>
            </div>
            <p className="text-neutral-600">Historic events and milestones in sports</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MomentCard
              title="Champions League Final 2026"
              description="The ultimate showdown between Europe's elite clubs. Witness history in the making."
              imageUrl="https://images.unsplash.com/photo-1759446334429-bb1f2d1d9f13?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGFtcGlvbnMlMjBsZWFndWUlMjB0cm9waHklMjBjZWxlYnJhdGlvbnxlbnwxfHx8fDE3NzA4MTU2MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
              label="Champions League"
              onClick={() => onNavigate("match", "1")}
            />
            <MomentCard
              title="World Cup 2026"
              description="The greatest tournament on earth returns to North America. Every nation's dream."
              imageUrl="https://images.unsplash.com/photo-1705593973313-75de7bf95b56?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b3JsZCUyMGN1cCUyMHN0YWRpdW0lMjBhdG1vc3BoZXJlfGVufDF8fHx8MTc3MDgxNTYwN3ww&ixlib=rb-4.1.0&q=80&w=1080"
              label="World Cup"
              onClick={() => {}}
            />
            <MomentCard
              title="Transfer Window 2026"
              description="Track every major move as clubs reshape their squads for the season ahead."
              imageUrl="https://images.unsplash.com/photo-1651046943797-e1874e1fe476?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW5jaGVzdGVyJTIwY2l0eSUyMHRlYW0lMjBjZWxlYnJhdGlvbnxlbnwxfHx8fDE3NzA4MTU2MDN8MA&ixlib=rb-4.1.0&q=80&w=1080"
              label="Transfers"
              onClick={() => {}}
            />
          </div>
        </div>
      </section>

      {/* Top Teams Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-blue-500" />
                <h2 className="text-3xl font-bold text-neutral-900">Top Teams</h2>
              </div>
              <p className="text-neutral-600">Elite clubs from around the world</p>
            </div>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              See all teams
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <TeamCard
              name="Manchester City"
              league="Premier League"
              country="England"
              logoText="MC"
              record="22-4-2"
              onClick={() => onNavigate("team", "1")}
            />
            <TeamCard
              name="Real Madrid"
              league="La Liga"
              country="Spain"
              logoText="RM"
              record="20-5-3"
              onClick={() => onNavigate("team", "2")}
            />
            <TeamCard
              name="Bayern Munich"
              league="Bundesliga"
              country="Germany"
              logoText="FCB"
              record="21-3-4"
              onClick={() => onNavigate("team", "3")}
            />
            <TeamCard
              name="Paris Saint-Germain"
              league="Ligue 1"
              country="France"
              logoText="PSG"
              record="23-3-2"
              onClick={() => onNavigate("team", "4")}
            />
          </div>
        </div>
      </section>

      {/* Exploration Hooks */}
      <section className="py-16 bg-gradient-to-b from-neutral-50 to-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rising Players */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Rising Stars</h3>
              <p className="text-neutral-600 mb-4 text-sm">
                Discover the next generation of football talent breaking into the scene
              </p>
              <button className="text-blue-600 font-medium text-sm hover:text-blue-700 flex items-center gap-1">
                Explore players
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Historic Rivalries */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Historic Rivalries</h3>
              <p className="text-neutral-600 mb-4 text-sm">
                Explore the greatest matchups and intense competitions throughout history
              </p>
              <button className="text-blue-600 font-medium text-sm hover:text-blue-700 flex items-center gap-1">
                View rivalries
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Recently Updated */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Recently Updated</h3>
              <p className="text-neutral-600 mb-4 text-sm">
                Check out the latest profile updates and newly added information
              </p>
              <button className="text-blue-600 font-medium text-sm hover:text-blue-700 flex items-center gap-1">
                See updates
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Statistics Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">The World's Sports Database</h2>
            <p className="text-xl text-blue-100">Comprehensive, accurate, and updated daily</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="text-5xl font-bold mb-2">250K+</div>
              <div className="text-blue-200 font-medium mb-1">Players</div>
              <div className="text-xs text-blue-300">From 120+ leagues</div>
            </div>

            <div className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="text-5xl font-bold mb-2">15K+</div>
              <div className="text-blue-200 font-medium mb-1">Teams</div>
              <div className="text-xs text-blue-300">Across all continents</div>
            </div>

            <div className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Globe className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="text-5xl font-bold mb-2">500+</div>
              <div className="text-blue-200 font-medium mb-1">Competitions</div>
              <div className="text-xs text-blue-300">National & international</div>
            </div>

            <div className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="text-5xl font-bold mb-2">2M+</div>
              <div className="text-blue-200 font-medium mb-1">Matches</div>
              <div className="text-xs text-blue-300">Updated in real-time</div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <Database className="w-5 h-5 text-blue-200" />
              <span className="text-sm font-medium text-blue-100">Database updated every 5 minutes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">SportsDB</span>
              </div>
              <p className="text-sm text-neutral-400">
                The most comprehensive international sports database
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Browse</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><button className="hover:text-white transition-colors">Players</button></li>
                <li><button className="hover:text-white transition-colors">Teams</button></li>
                <li><button className="hover:text-white transition-colors">Competitions</button></li>
                <li><button className="hover:text-white transition-colors">Matches</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><button className="hover:text-white transition-colors">API</button></li>
                <li><button className="hover:text-white transition-colors">Documentation</button></li>
                <li><button className="hover:text-white transition-colors">Contributors</button></li>
                <li><button className="hover:text-white transition-colors">About</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Connect</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><button className="hover:text-white transition-colors">Twitter</button></li>
                <li><button className="hover:text-white transition-colors">Instagram</button></li>
                <li><button className="hover:text-white transition-colors">Discord</button></li>
                <li><button className="hover:text-white transition-colors">GitHub</button></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-800 text-center text-sm text-neutral-500">
            © 2026 SportsDB. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}