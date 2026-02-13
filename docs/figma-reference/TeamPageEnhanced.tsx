import { ArrowLeft, MapPin, Trophy, Users, Calendar, TrendingUp, Star, Shield } from "lucide-react";
import { useState } from "react";
import { TimeToggle } from "../TimeToggle";
import { KnowledgeCard } from "../KnowledgeCard";

interface TeamPageEnhancedProps {
  teamId: string;
  onNavigate: (page: string, id?: string) => void;
  onBack: () => void;
}

export function TeamPageEnhanced({ teamId, onNavigate, onBack }: TeamPageEnhancedProps) {
  const [timeView, setTimeView] = useState<"now" | "historical">("now");
  const [selectedSeason, setSelectedSeason] = useState("2025/26");
  const [squadFilter, setSquadFilter] = useState<"all" | "GK" | "DEF" | "MID" | "FWD">("all");
  
  const teamData = {
    name: "Manchester City",
    founded: 1880,
    city: "Manchester",
    country: "England",
    stadium: "Etihad Stadium",
    capacity: "53,400",
    league: "Premier League",
    leaguePosition: 1,
    imageUrl: "https://images.unsplash.com/photo-1651043421470-88b023bb9636?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMHN0YWRpdW0lMjBhZXJpYWwlMjB2aWV3fGVufDF8fHx8MTc3MDcwMjQ3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    squad: [
      { id: "1", name: "Erling Haaland", position: "FWD", number: 9, age: 25, imageUrl: "" },
      { id: "2", name: "Phil Foden", position: "MID", number: 47, age: 24, imageUrl: "" },
      { id: "3", name: "Kevin De Bruyne", position: "MID", number: 17, age: 33, imageUrl: "" },
      { id: "4", name: "Jack Grealish", position: "FWD", number: 10, age: 29, imageUrl: "" },
      { id: "5", name: "Ruben Dias", position: "DEF", number: 3, age: 27, imageUrl: "" },
      { id: "6", name: "Ederson", position: "GK", number: 31, age: 31, imageUrl: "" },
    ],
    staff: [
      { id: "1", name: "Pep Guardiola", role: "Manager", since: "2016" },
      { id: "2", name: "Juanma Lillo", role: "Assistant Coach", since: "2020" },
    ],
    seasonPerformance: {
      position: 1,
      played: 28,
      won: 22,
      drawn: 4,
      lost: 2,
      points: 70,
      goalsFor: 68,
      goalsAgainst: 20,
    },
    upcomingFixtures: [
      { id: "1", opponent: "Liverpool", type: "home", date: "Feb 15, 2026", time: "15:00", competition: "Premier League" },
      { id: "2", opponent: "Real Madrid", type: "away", date: "Feb 19, 2026", time: "21:00", competition: "Champions League" },
    ],
    recentResults: [
      { id: "3", opponent: "Chelsea", type: "home", score: "3-0", date: "Feb 8, 2026", competition: "Premier League" },
      { id: "4", opponent: "Tottenham", type: "away", score: "2-2", date: "Feb 1, 2026", competition: "Premier League" },
    ],
    honours: [
      { title: "Premier League", count: 9, recentYears: ["2023/24", "2022/23", "2021/22"] },
      { title: "Champions League", count: 1, recentYears: ["2022/23"] },
      { title: "FA Cup", count: 7, recentYears: ["2022/23", "2018/19"] },
    ],
  };

  const filteredSquad = squadFilter === "all" 
    ? teamData.squad 
    : teamData.squad.filter(p => p.position === squadFilter);
  
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
            <div className="hidden md:block">
              <TimeToggle
                currentView={timeView}
                onViewChange={setTimeView}
                selectedSeason={selectedSeason}
                onSeasonChange={setSelectedSeason}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={teamData.imageUrl}
            alt={teamData.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-900/40 to-transparent" />
        </div>

        <div className="relative h-full max-w-7xl mx-auto px-4 flex items-end pb-12">
          <div className="flex items-end gap-8 w-full">
            {/* Team Crest */}
            <div className="hidden md:block w-40 h-40 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl flex items-center justify-center text-white text-6xl font-bold shadow-2xl">
              MC
            </div>

            <div className="flex-1">
              {/* League Position Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 backdrop-blur-sm border border-yellow-400/30 rounded-full mb-4">
                <Trophy className="w-4 h-4 text-yellow-300" />
                <span className="text-sm font-semibold text-yellow-100">1st in {teamData.league}</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
                {teamData.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-white/90 mb-6">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{teamData.city}, {teamData.country}</span>
                </div>
                <div className="w-1 h-1 bg-white/40 rounded-full" />
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Founded {teamData.founded}</span>
                </div>
                <div className="w-1 h-1 bg-white/40 rounded-full" />
                <button 
                  onClick={() => {}}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span>{teamData.stadium}</span>
                </button>
              </div>

              <div className="flex gap-3">
                <button className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-all flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Follow Team
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden absolute top-4 right-4">
          <TimeToggle
            currentView={timeView}
            onViewChange={setTimeView}
            selectedSeason={selectedSeason}
            onSeasonChange={setSelectedSeason}
          />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Season Performance */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold">Season Performance</h2>
                {timeView === "historical" && (
                  <span className="text-sm text-neutral-500">({selectedSeason})</span>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-blue-600">{teamData.seasonPerformance.position}</div>
                  <div className="text-xs text-neutral-600 mt-1">Position</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-600">{teamData.seasonPerformance.played}</div>
                  <div className="text-xs text-neutral-600 mt-1">Played</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-600">{teamData.seasonPerformance.won}</div>
                  <div className="text-xs text-neutral-600 mt-1">Won</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-yellow-600">{teamData.seasonPerformance.drawn}</div>
                  <div className="text-xs text-neutral-600 mt-1">Drawn</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-600">{teamData.seasonPerformance.lost}</div>
                  <div className="text-xs text-neutral-600 mt-1">Lost</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-600">{teamData.seasonPerformance.points}</div>
                  <div className="text-xs text-neutral-600 mt-1">Points</div>
                </div>
              </div>
            </div>

            {/* Squad */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <h2 className="text-2xl font-bold">Squad</h2>
                </div>
                {/* Position Filter */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSquadFilter("all")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      squadFilter === "all" 
                        ? "bg-blue-600 text-white" 
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSquadFilter("GK")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      squadFilter === "GK" 
                        ? "bg-blue-600 text-white" 
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    GK
                  </button>
                  <button
                    onClick={() => setSquadFilter("DEF")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      squadFilter === "DEF" 
                        ? "bg-blue-600 text-white" 
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    DEF
                  </button>
                  <button
                    onClick={() => setSquadFilter("MID")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      squadFilter === "MID" 
                        ? "bg-blue-600 text-white" 
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    MID
                  </button>
                  <button
                    onClick={() => setSquadFilter("FWD")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      squadFilter === "FWD" 
                        ? "bg-blue-600 text-white" 
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    FWD
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSquad.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate("player", player.id)}
                    className="flex items-center gap-4 p-4 bg-neutral-50 hover:bg-blue-50 rounded-xl transition-colors border border-neutral-200 hover:border-blue-200 group"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
                      {player.number}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-neutral-900 group-hover:text-blue-600">
                        {player.name}
                      </div>
                      <div className="text-sm text-neutral-600">{player.position} • {player.age} years</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fixtures & Results */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">Upcoming Fixtures</h2>
              <div className="space-y-3 mb-8">
                {teamData.upcomingFixtures.map((fixture) => (
                  <button
                    key={fixture.id}
                    onClick={() => onNavigate("match", fixture.id)}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200"
                  >
                    <div className="text-left">
                      <div className="font-semibold text-neutral-900">
                        {fixture.type === "home" ? "vs" : "@"} {fixture.opponent}
                      </div>
                      <div className="text-sm text-neutral-600">{fixture.competition}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{fixture.date}</div>
                      <div className="text-sm text-neutral-600">{fixture.time}</div>
                    </div>
                  </button>
                ))}
              </div>

              <h3 className="text-xl font-bold mb-4 pt-6 border-t border-neutral-200">Recent Results</h3>
              <div className="space-y-3">
                {teamData.recentResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => onNavigate("match", result.id)}
                    className="w-full flex items-center justify-between p-4 bg-neutral-50 hover:bg-neutral-100 rounded-xl transition-colors border border-neutral-200"
                  >
                    <div className="text-left">
                      <div className="font-semibold text-neutral-900">
                        {result.type === "home" ? "vs" : "@"} {result.opponent}
                      </div>
                      <div className="text-sm text-neutral-600">{result.competition}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl">{result.score}</div>
                      <div className="text-sm text-neutral-600">{result.date}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Honours */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-bold">Honours</h2>
              </div>
              <div className="space-y-6">
                {teamData.honours.map((honour, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">🏆</div>
                        <div>
                          <div className="font-bold text-lg">{honour.title}</div>
                          <div className="text-sm text-neutral-600">×{honour.count}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {honour.recentYears.map((year) => (
                        <span 
                          key={year}
                          className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium"
                        >
                          {year}
                        </span>
                      ))}
                      {honour.count > honour.recentYears.length && (
                        <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-sm">
                          +{honour.count - honour.recentYears.length} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Staff */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Coaching Staff</h3>
              <div className="space-y-3">
                {teamData.staff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => onNavigate("player", staff.id)}
                    className="w-full text-left p-3 bg-neutral-50 hover:bg-blue-50 rounded-xl transition-colors group"
                  >
                    <div className="font-semibold text-neutral-900 group-hover:text-blue-600">
                      {staff.name}
                    </div>
                    <div className="text-sm text-neutral-600">{staff.role}</div>
                    <div className="text-xs text-neutral-500 mt-1">Since {staff.since}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Quick Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Stadium</span>
                  <span className="font-medium">{teamData.stadium}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Capacity</span>
                  <span className="font-medium">{teamData.capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Founded</span>
                  <span className="font-medium">{teamData.founded}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">City</span>
                  <span className="font-medium">{teamData.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Country</span>
                  <span className="font-medium">{teamData.country}</span>
                </div>
              </div>
            </div>

            {/* Competition */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
              <h3 className="font-bold text-lg mb-4">Current Competition</h3>
              <button 
                onClick={() => onNavigate("competition", "1")}
                className="w-full text-left p-4 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-colors"
              >
                <div className="text-2xl mb-2">🏆</div>
                <div className="font-bold text-xl">{teamData.league}</div>
                <div className="text-sm text-purple-100 mt-2">
                  Current position: {teamData.leaguePosition}st
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
