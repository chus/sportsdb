import { Search, TrendingUp, Users, Trophy, Calendar } from "lucide-react";
import { SearchBar } from "../SearchBar";

interface HomePageProps {
  onSearch: (query: string) => void;
  onNavigate: (page: string, id?: string) => void;
}

export function HomePage({ onSearch, onNavigate }: HomePageProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-neutral-900">SportsDB</h1>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <button className="text-neutral-600 hover:text-neutral-900">Players</button>
              <button className="text-neutral-600 hover:text-neutral-900">Teams</button>
              <button className="text-neutral-600 hover:text-neutral-900">Competitions</button>
              <button className="text-neutral-600 hover:text-neutral-900">Matches</button>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Hero Search Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              The International Sports Database
            </h2>
            <p className="text-lg md:text-xl text-blue-100">
              Explore players, teams, matches, and competitions from around the world
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <SearchBar 
              onSearch={onSearch}
              onResultClick={(result) => {
                if (result.type === "player") onNavigate("player", result.id);
                if (result.type === "team") onNavigate("team", result.id);
                if (result.type === "match") onNavigate("match", result.id);
              }}
              autoFocus
            />
          </div>
          
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <span className="text-sm text-blue-100">Try:</span>
            <button 
              onClick={() => onNavigate("player", "1")}
              className="text-sm underline hover:text-white"
            >
              Erling Haaland
            </button>
            <button 
              onClick={() => onNavigate("team", "1")}
              className="text-sm underline hover:text-white"
            >
              Manchester City
            </button>
            <button 
              onClick={() => onNavigate("match", "1")}
              className="text-sm underline hover:text-white"
            >
              Champions League Final 2026
            </button>
          </div>
        </div>
      </div>
      
      {/* Featured Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <TrendingUp className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-lg mb-2">Trending Players</h3>
            <p className="text-sm text-neutral-600 mb-4">Most searched this week</p>
            <div className="space-y-2">
              <button 
                onClick={() => onNavigate("player", "1")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Erling Haaland
              </button>
              <button 
                onClick={() => onNavigate("player", "2")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Kylian Mbappé
              </button>
              <button 
                onClick={() => onNavigate("player", "3")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Vinicius Junior
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <Users className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-lg mb-2">Top Teams</h3>
            <p className="text-sm text-neutral-600 mb-4">Elite clubs worldwide</p>
            <div className="space-y-2">
              <button 
                onClick={() => onNavigate("team", "1")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Manchester City
              </button>
              <button 
                onClick={() => onNavigate("team", "2")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Real Madrid
              </button>
              <button 
                onClick={() => onNavigate("team", "3")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Bayern Munich
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <Calendar className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-lg mb-2">Recent Matches</h3>
            <p className="text-sm text-neutral-600 mb-4">Latest results</p>
            <div className="space-y-2">
              <button 
                onClick={() => onNavigate("match", "1")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Man City 2-1 Liverpool
              </button>
              <button 
                onClick={() => onNavigate("match", "2")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Real Madrid 3-2 Barcelona
              </button>
              <button 
                onClick={() => onNavigate("match", "3")}
                className="w-full text-left text-sm text-blue-600 hover:underline"
              >
                Bayern 4-0 Dortmund
              </button>
            </div>
          </div>
        </div>
        
        {/* Stats Section */}
        <div className="bg-white border border-neutral-200 rounded-lg p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">250K+</div>
              <div className="text-sm text-neutral-600 mt-1">Players</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">15K+</div>
              <div className="text-sm text-neutral-600 mt-1">Teams</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">500+</div>
              <div className="text-sm text-neutral-600 mt-1">Competitions</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">2M+</div>
              <div className="text-sm text-neutral-600 mt-1">Matches</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
