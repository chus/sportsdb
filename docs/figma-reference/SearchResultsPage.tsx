import { Search, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { SearchBar } from "../SearchBar";
import { KnowledgeCard } from "../KnowledgeCard";

interface SearchResultsPageProps {
  query: string;
  onNavigate: (page: string, id?: string) => void;
  onBack: () => void;
}

export function SearchResultsPage({ query, onNavigate, onBack }: SearchResultsPageProps) {
  const [activeTab, setActiveTab] = useState<"all" | "players" | "teams" | "staff" | "matches" | "competitions">("all");
  
  const tabs = [
    { id: "all" as const, label: "All", count: 42 },
    { id: "players" as const, label: "Players", count: 15 },
    { id: "teams" as const, label: "Teams", count: 8 },
    { id: "staff" as const, label: "Staff", count: 5 },
    { id: "matches" as const, label: "Matches", count: 12 },
    { id: "competitions" as const, label: "Competitions", count: 2 },
  ];
  
  const mockPlayers = [
    { id: "1", name: "Erling Haaland", team: "Manchester City", position: "Forward", nationality: "Norway" },
    { id: "2", name: "Phil Foden", team: "Manchester City", position: "Midfielder", nationality: "England" },
    { id: "3", name: "Jack Grealish", team: "Manchester City", position: "Winger", nationality: "England" },
  ];
  
  const mockTeams = [
    { id: "1", name: "Manchester City", league: "Premier League", country: "England" },
    { id: "2", name: "Manchester United", league: "Premier League", country: "England" },
  ];
  
  const mockStaff = [
    { id: "1", name: "Pep Guardiola", team: "Manchester City", role: "Manager" },
    { id: "2", name: "Erik ten Hag", team: "Manchester United", role: "Manager" },
  ];
  
  const mockMatches = [
    { id: "1", home: "Man City", away: "Man Utd", score: "2-1", date: "Feb 8, 2026", competition: "Premier League" },
    { id: "2", home: "Man City", away: "Liverpool", score: "1-1", date: "Feb 1, 2026", competition: "Premier League" },
  ];
  
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-neutral-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <SearchBar 
                onSearch={(q) => {/* Update results */}}
                onResultClick={(result) => {
                  if (result.type === "player") onNavigate("player", result.id);
                  if (result.type === "team") onNavigate("team", result.id);
                }}
              />
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 -mb-[1px]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {tab.label} <span className="text-neutral-400">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </header>
      
      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">
            Search results for "<span className="text-blue-600">{query}</span>"
          </h2>
          <p className="text-sm text-neutral-600 mt-1">
            Found 42 results across all categories
          </p>
        </div>
        
        <div className="space-y-8">
          {/* Players Section */}
          {(activeTab === "all" || activeTab === "players") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Players</h3>
                {activeTab === "all" && (
                  <button 
                    onClick={() => setActiveTab("players")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    See all 15 →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mockPlayers.map((player) => (
                  <KnowledgeCard
                    key={player.id}
                    title={player.name}
                    subtitle={player.team}
                    meta={[player.position, player.nationality]}
                    onClick={() => onNavigate("player", player.id)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Teams Section */}
          {(activeTab === "all" || activeTab === "teams") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Teams</h3>
                {activeTab === "all" && (
                  <button 
                    onClick={() => setActiveTab("teams")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    See all 8 →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mockTeams.map((team) => (
                  <KnowledgeCard
                    key={team.id}
                    title={team.name}
                    subtitle={team.league}
                    meta={[team.country]}
                    onClick={() => onNavigate("team", team.id)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Staff Section */}
          {(activeTab === "all" || activeTab === "staff") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Staff</h3>
                {activeTab === "all" && (
                  <button 
                    onClick={() => setActiveTab("staff")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    See all 5 →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mockStaff.map((staff) => (
                  <KnowledgeCard
                    key={staff.id}
                    title={staff.name}
                    subtitle={staff.team}
                    meta={[staff.role]}
                    onClick={() => onNavigate("player", staff.id)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Matches Section */}
          {(activeTab === "all" || activeTab === "matches") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Matches</h3>
                {activeTab === "all" && (
                  <button 
                    onClick={() => setActiveTab("matches")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    See all 12 →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mockMatches.map((match) => (
                  <KnowledgeCard
                    key={match.id}
                    title={`${match.home} ${match.score} ${match.away}`}
                    subtitle={match.competition}
                    meta={[match.date]}
                    onClick={() => onNavigate("match", match.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
