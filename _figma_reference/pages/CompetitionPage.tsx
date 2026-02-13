import { ArrowLeft, Trophy, TrendingUp, Calendar, ChevronRight } from "lucide-react";
import { useState } from "react";

interface CompetitionPageProps {
  competitionId: string;
  onNavigate: (page: string, id?: string) => void;
  onBack: () => void;
}

export function CompetitionPage({ competitionId, onNavigate, onBack }: CompetitionPageProps) {
  const [selectedSeason, setSelectedSeason] = useState("2025/26");
  const [sortBy, setSortBy] = useState<"position" | "points" | "gd">("position");

  const competitionData = {
    name: "Premier League",
    country: "England",
    type: "League",
    founded: 1992,
    currentSeason: "2025/26",
    logo: "🏆",
    imageUrl: "https://images.unsplash.com/photo-1641628878413-5ef336e3a350?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaWVyJTIwbGVhZ3VlJTIwdHJvcGh5JTIwY2VsZWJyYXRpb258ZW58MXx8fHwxNzcwODE2MjIzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    standings: [
      { id: "1", pos: 1, team: "Manchester City", played: 28, won: 22, drawn: 4, lost: 2, gf: 68, ga: 20, gd: 48, points: 70 },
      { id: "2", pos: 2, team: "Arsenal", played: 28, won: 20, drawn: 5, lost: 3, gf: 62, ga: 25, gd: 37, points: 65 },
      { id: "3", pos: 3, team: "Liverpool", played: 28, won: 19, drawn: 6, lost: 3, gf: 58, ga: 24, gd: 34, points: 63 },
      { id: "4", pos: 4, team: "Chelsea", played: 28, won: 17, drawn: 7, lost: 4, gf: 54, ga: 28, gd: 26, points: 58 },
      { id: "5", pos: 5, team: "Manchester United", played: 28, won: 16, drawn: 6, lost: 6, gf: 50, ga: 32, gd: 18, points: 54 },
    ],
    topScorers: [
      { id: "1", player: "Erling Haaland", team: "Manchester City", goals: 32, imageUrl: "" },
      { id: "2", player: "Mohamed Salah", team: "Liverpool", goals: 24, imageUrl: "" },
      { id: "3", player: "Bukayo Saka", team: "Arsenal", goals: 21, imageUrl: "" },
    ],
    recentMatches: [
      { id: "1", home: "Man City", away: "Liverpool", score: "2-1", date: "Feb 8, 2026" },
      { id: "2", home: "Arsenal", away: "Chelsea", score: "3-1", date: "Feb 8, 2026" },
      { id: "3", home: "Man Utd", away: "Tottenham", score: "1-1", date: "Feb 7, 2026" },
    ],
    pastSeasons: [
      { season: "2024/25", champion: "Manchester City", topScorer: "Erling Haaland - 36 goals" },
      { season: "2023/24", champion: "Manchester City", topScorer: "Erling Haaland - 34 goals" },
      { season: "2022/23", champion: "Manchester City", topScorer: "Erling Haaland - 36 goals" },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="2025/26">2025/26 Season</option>
              <option value="2024/25">2024/25 Season</option>
              <option value="2023/24">2023/24 Season</option>
            </select>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-[400px] overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={competitionData.imageUrl}
            alt={competitionData.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        </div>

        <div className="relative h-full max-w-7xl mx-auto px-4 flex items-end pb-12">
          <div className="flex items-end gap-8 w-full">
            <div className="text-8xl">🏆</div>
            <div className="flex-1">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
                {competitionData.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-white/90">
                <span>{competitionData.country}</span>
                <div className="w-1 h-1 bg-white/40 rounded-full" />
                <span>{competitionData.type}</span>
                <div className="w-1 h-1 bg-white/40 rounded-full" />
                <span>Founded {competitionData.founded}</span>
                <div className="w-1 h-1 bg-white/40 rounded-full" />
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold">
                  Season {competitionData.currentSeason}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Standings Table */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  <h2 className="text-2xl font-bold">Standings</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortBy("position")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg ${
                      sortBy === "position" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    Position
                  </button>
                  <button
                    onClick={() => setSortBy("points")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg ${
                      sortBy === "points" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    Points
                  </button>
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-neutral-600 border-b border-neutral-200">
                      <th className="pb-3 pr-4">Pos</th>
                      <th className="pb-3">Team</th>
                      <th className="pb-3 text-center">P</th>
                      <th className="pb-3 text-center">W</th>
                      <th className="pb-3 text-center">D</th>
                      <th className="pb-3 text-center">L</th>
                      <th className="pb-3 text-center">GD</th>
                      <th className="pb-3 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitionData.standings.map((team, index) => (
                      <tr 
                        key={team.id}
                        className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50"
                      >
                        <td className="py-4 pr-4">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                            index === 0 ? "bg-yellow-100 text-yellow-700" :
                            index < 4 ? "bg-blue-100 text-blue-700" :
                            "bg-neutral-100 text-neutral-700"
                          }`}>
                            {team.pos}
                          </div>
                        </td>
                        <td className="py-4">
                          <button 
                            onClick={() => onNavigate("team", team.id)}
                            className="flex items-center gap-3 hover:text-blue-600 transition-colors group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                              {team.team.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold">{team.team}</span>
                          </button>
                        </td>
                        <td className="py-4 text-center text-sm">{team.played}</td>
                        <td className="py-4 text-center text-sm">{team.won}</td>
                        <td className="py-4 text-center text-sm">{team.drawn}</td>
                        <td className="py-4 text-center text-sm">{team.lost}</td>
                        <td className="py-4 text-center text-sm font-medium">{team.gd > 0 ? '+' : ''}{team.gd}</td>
                        <td className="py-4 text-center font-bold text-blue-600">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {competitionData.standings.map((team, index) => (
                  <button
                    key={team.id}
                    onClick={() => onNavigate("team", team.id)}
                    className="w-full flex items-center gap-4 p-4 bg-neutral-50 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      index === 0 ? "bg-yellow-100 text-yellow-700" :
                      index < 4 ? "bg-blue-100 text-blue-700" :
                      "bg-neutral-100 text-neutral-700"
                    }`}>
                      {team.pos}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{team.team}</div>
                      <div className="text-sm text-neutral-600">
                        {team.won}W {team.drawn}D {team.lost}L • GD {team.gd > 0 ? '+' : ''}{team.gd}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{team.points}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Matches */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold">Recent Matches</h2>
              </div>
              <div className="space-y-3">
                {competitionData.recentMatches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => onNavigate("match", match.id)}
                    className="w-full flex items-center justify-between p-4 bg-neutral-50 hover:bg-neutral-100 rounded-xl transition-colors"
                  >
                    <div className="text-left">
                      <div className="font-semibold">{match.home} vs {match.away}</div>
                      <div className="text-sm text-neutral-600">{match.date}</div>
                    </div>
                    <div className="text-2xl font-bold text-neutral-900">{match.score}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Season Archive */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">Season Archive</h2>
              <div className="space-y-3">
                {competitionData.pastSeasons.map((season) => (
                  <button
                    key={season.season}
                    onClick={() => onNavigate("season", season.season)}
                    className="w-full flex items-center justify-between p-4 bg-neutral-50 hover:bg-blue-50 rounded-xl transition-colors group"
                  >
                    <div className="text-left">
                      <div className="font-semibold text-neutral-900 group-hover:text-blue-600">
                        Season {season.season}
                      </div>
                      <div className="text-sm text-neutral-600 mt-1">
                        🏆 {season.champion} • ⚽ {season.topScorer}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Scorers */}
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5" />
                <h3 className="font-bold text-lg">Top Scorers</h3>
              </div>
              <div className="space-y-4">
                {competitionData.topScorers.map((scorer, index) => (
                  <button
                    key={scorer.id}
                    onClick={() => onNavigate("player", scorer.id)}
                    className="w-full flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-xl">
                      {index + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{scorer.player}</div>
                      <div className="text-sm text-orange-100">{scorer.team}</div>
                    </div>
                    <div className="text-2xl font-bold">{scorer.goals}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Competition Info */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Competition Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Country</span>
                  <span className="font-medium">{competitionData.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Type</span>
                  <span className="font-medium">{competitionData.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Founded</span>
                  <span className="font-medium">{competitionData.founded}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Teams</span>
                  <span className="font-medium">20</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
