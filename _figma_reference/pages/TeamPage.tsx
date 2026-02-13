import { ArrowLeft, MapPin, Trophy, Users, Calendar } from "lucide-react";
import { useState } from "react";
import { TimeToggle } from "../TimeToggle";
import { KnowledgeCard } from "../KnowledgeCard";

interface TeamPageProps {
  teamId: string;
  onNavigate: (page: string, id?: string) => void;
  onBack: () => void;
}

export function TeamPage({ teamId, onNavigate, onBack }: TeamPageProps) {
  const [timeView, setTimeView] = useState<"now" | "historical">("now");
  const [selectedSeason, setSelectedSeason] = useState("2025/26");
  
  const currentData = {
    name: "Manchester City",
    league: "Premier League",
    country: "England",
    stadium: "Etihad Stadium",
    founded: 1880,
    manager: "Pep Guardiola",
    squad: [
      { id: "1", name: "Erling Haaland", position: "Forward", number: 9 },
      { id: "2", name: "Phil Foden", position: "Midfielder", number: 47 },
      { id: "3", name: "Kevin De Bruyne", position: "Midfielder", number: 17 },
      { id: "4", name: "Jack Grealish", position: "Winger", number: 10 },
      { id: "5", name: "Ruben Dias", position: "Defender", number: 3 },
      { id: "6", name: "Ederson", position: "Goalkeeper", number: 31 },
    ],
    staff: [
      { id: "1", name: "Pep Guardiola", role: "Manager" },
      { id: "2", name: "Juanma Lillo", role: "Assistant Coach" },
    ],
    fixtures: [
      { id: "1", opponent: "Liverpool", type: "home", date: "Feb 15, 2026", time: "15:00", competition: "Premier League" },
      { id: "2", opponent: "Real Madrid", type: "away", date: "Feb 19, 2026", time: "21:00", competition: "Champions League" },
      { id: "3", opponent: "Arsenal", type: "home", date: "Feb 22, 2026", time: "17:30", competition: "Premier League" },
    ],
    results: [
      { id: "4", opponent: "Chelsea", type: "home", score: "3-0", date: "Feb 8, 2026", competition: "Premier League" },
      { id: "5", opponent: "Tottenham", type: "away", score: "2-2", date: "Feb 1, 2026", competition: "Premier League" },
    ],
    honours: [
      { title: "Premier League", count: 9, years: ["2023/24", "2022/23", "2021/22", "2020/21", "2018/19"] },
      { title: "Champions League", count: 1, years: ["2022/23"] },
      { title: "FA Cup", count: 7, years: ["2022/23", "2018/19"] },
    ],
    seasonStats: {
      position: 1,
      played: 28,
      won: 22,
      drawn: 4,
      lost: 2,
      points: 70,
    },
  };
  
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-neutral-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Team Profile</div>
              <h1 className="text-2xl font-bold">{currentData.name}</h1>
            </div>
            <div className="hidden md:block">
              <TimeToggle
                currentView={timeView}
                onViewChange={setTimeView}
                selectedSeason={selectedSeason}
                onSeasonChange={setSelectedSeason}
              />
            </div>
          </div>
          <div className="md:hidden mt-4">
            <TimeToggle
              currentView={timeView}
              onViewChange={setTimeView}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
            />
          </div>
        </div>
      </header>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-blue-600 rounded-lg flex-shrink-0 flex items-center justify-center text-6xl text-white font-bold">
                  MC
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-3">{currentData.name}</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-neutral-400" />
                      <span className="text-neutral-600">League:</span>
                      <span className="font-medium">{currentData.league}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-neutral-400" />
                      <span className="text-neutral-600">Country:</span>
                      <span className="font-medium">{currentData.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-neutral-400" />
                      <span className="text-neutral-600">Stadium:</span>
                      <span className="font-medium">{currentData.stadium}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-neutral-400" />
                      <span className="text-neutral-600">Founded:</span>
                      <span className="font-medium">{currentData.founded}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Season Stats */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">
                Season Standing {timeView === "historical" && `(${selectedSeason})`}
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{currentData.seasonStats.position}</div>
                  <div className="text-xs text-neutral-600 mt-1">Position</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{currentData.seasonStats.played}</div>
                  <div className="text-xs text-neutral-600 mt-1">Played</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{currentData.seasonStats.won}</div>
                  <div className="text-xs text-neutral-600 mt-1">Won</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{currentData.seasonStats.drawn}</div>
                  <div className="text-xs text-neutral-600 mt-1">Drawn</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{currentData.seasonStats.lost}</div>
                  <div className="text-xs text-neutral-600 mt-1">Lost</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{currentData.seasonStats.points}</div>
                  <div className="text-xs text-neutral-600 mt-1">Points</div>
                </div>
              </div>
            </div>
            
            {/* Squad List */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Squad</h3>
              <div className="space-y-2">
                {currentData.squad.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate("player", player.id)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-neutral-50 rounded border border-neutral-100"
                  >
                    <div className="w-10 h-10 bg-blue-600 text-white rounded flex items-center justify-center font-bold">
                      {player.number}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-neutral-600">{player.position}</div>
                    </div>
                  </button>
                ))}
                <button className="w-full py-3 text-sm text-blue-600 hover:underline">
                  View full squad →
                </button>
              </div>
            </div>
            
            {/* Staff */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Coaching Staff</h3>
              <div className="space-y-2">
                {currentData.staff.map((staff) => (
                  <KnowledgeCard
                    key={staff.id}
                    title={staff.name}
                    subtitle={staff.role}
                    onClick={() => onNavigate("player", staff.id)}
                  />
                ))}
              </div>
            </div>
            
            {/* Fixtures & Results */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Upcoming Fixtures</h3>
              <div className="space-y-2 mb-6">
                {currentData.fixtures.map((fixture) => (
                  <button
                    key={fixture.id}
                    onClick={() => onNavigate("match", fixture.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 rounded border border-neutral-100"
                  >
                    <div className="text-left">
                      <div className="font-medium">
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
              
              <h3 className="font-semibold text-lg mb-4 pt-4 border-t border-neutral-200">Recent Results</h3>
              <div className="space-y-2">
                {currentData.results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => onNavigate("match", result.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 rounded border border-neutral-100"
                  >
                    <div className="text-left">
                      <div className="font-medium">
                        {result.type === "home" ? "vs" : "@"} {result.opponent}
                      </div>
                      <div className="text-sm text-neutral-600">{result.competition}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{result.score}</div>
                      <div className="text-sm text-neutral-600">{result.date}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Honours */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Honours
              </h3>
              <div className="space-y-4">
                {currentData.honours.map((honour, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{honour.title}</span>
                      <span className="text-sm text-neutral-600">×{honour.count}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {honour.years.map((year) => (
                        <span 
                          key={year}
                          className="text-xs px-2 py-1 bg-neutral-100 text-neutral-700 rounded"
                        >
                          {year}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Manager */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Manager</h3>
              <KnowledgeCard
                title={currentData.manager}
                subtitle="Since 2016"
                onClick={() => onNavigate("player", "1")}
              />
            </div>
            
            {/* Competition */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Competitions</h3>
              <div className="space-y-2">
                <KnowledgeCard
                  title="Premier League"
                  subtitle="1st place"
                  meta={["70 points"]}
                  size="compact"
                  onClick={() => {}}
                />
                <KnowledgeCard
                  title="Champions League"
                  subtitle="Round of 16"
                  size="compact"
                  onClick={() => {}}
                />
                <KnowledgeCard
                  title="FA Cup"
                  subtitle="Quarter Finals"
                  size="compact"
                  onClick={() => {}}
                />
              </div>
            </div>
            
            {/* Quick Info */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Quick Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Stadium</span>
                  <span className="font-medium">{currentData.stadium}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Capacity</span>
                  <span className="font-medium">53,400</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Founded</span>
                  <span className="font-medium">{currentData.founded}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
