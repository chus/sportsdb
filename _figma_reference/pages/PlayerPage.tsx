import { ArrowLeft, MapPin, Calendar, TrendingUp, Award, Users, ChevronRight } from "lucide-react";
import { useState } from "react";
import { TimeToggle } from "../TimeToggle";
import { KnowledgeCard } from "../KnowledgeCard";

interface PlayerPageProps {
  playerId: string;
  onNavigate: (page: string, id?: string) => void;
  onBack: () => void;
}

export function PlayerPage({ playerId, onNavigate, onBack }: PlayerPageProps) {
  const [timeView, setTimeView] = useState<"now" | "historical">("now");
  const [selectedSeason, setSelectedSeason] = useState("2025/26");
  
  // Mock data that changes based on time view
  const currentData = {
    name: "Erling Haaland",
    position: "Forward",
    team: "Manchester City",
    nationality: "Norway",
    age: 25,
    birthDate: "July 21, 2000",
    height: "1.95m",
    shirtNumber: 9,
    stats: {
      appearances: 28,
      goals: 32,
      assists: 8,
    },
    careerTimeline: [
      { club: "Manchester City", years: "2022 - Present", appearances: 102, goals: 105 },
      { club: "Borussia Dortmund", years: "2020 - 2022", appearances: 89, goals: 86 },
      { club: "RB Salzburg", years: "2019 - 2020", appearances: 27, goals: 29 },
      { club: "Molde FK", years: "2017 - 2019", appearances: 50, goals: 20 },
    ],
    awards: [
      { title: "Premier League Golden Boot", year: "2024/25" },
      { title: "PFA Player of the Year", year: "2023/24" },
      { title: "Champions League Top Scorer", year: "2022/23" },
    ],
    recentMatches: [
      { id: "1", opponent: "Liverpool", result: "W 2-1", goals: 1, date: "Feb 8, 2026" },
      { id: "2", opponent: "Arsenal", result: "D 1-1", goals: 1, date: "Feb 1, 2026" },
      { id: "3", opponent: "Chelsea", result: "W 3-0", goals: 2, date: "Jan 25, 2026" },
    ],
    teammates: [
      { id: "2", name: "Phil Foden", position: "Midfielder" },
      { id: "3", name: "Kevin De Bruyne", position: "Midfielder" },
      { id: "4", name: "Jack Grealish", position: "Winger" },
    ],
  };
  
  const historicalData = {
    ...currentData,
    team: "Borussia Dortmund",
    age: 22,
    shirtNumber: 9,
    stats: {
      appearances: 34,
      goals: 41,
      assists: 12,
    },
  };
  
  const data = timeView === "now" ? currentData : historicalData;
  
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
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Player Profile</div>
              <h1 className="text-2xl font-bold">{data.name}</h1>
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
                <div className="w-32 h-32 bg-neutral-200 rounded-lg flex-shrink-0 flex items-center justify-center text-6xl">
                  👤
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-3">{data.name}</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-neutral-400" />
                      <span className="text-neutral-600">Position:</span>
                      <span className="font-medium">{data.position}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-600">Shirt:</span>
                      <span className="font-medium">#{data.shirtNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-neutral-400" />
                      <span className="text-neutral-600">Nationality:</span>
                      <span className="font-medium">{data.nationality}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-neutral-400" />
                      <span className="text-neutral-600">Age:</span>
                      <span className="font-medium">{data.age}</span>
                    </div>
                    <div className="col-span-2">
                      <button 
                        onClick={() => onNavigate("team", "1")}
                        className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium"
                      >
                        {data.team}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats Card */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Season Stats {timeView === "historical" && `(${selectedSeason})`}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{data.stats.appearances}</div>
                  <div className="text-sm text-neutral-600 mt-1">Appearances</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{data.stats.goals}</div>
                  <div className="text-sm text-neutral-600 mt-1">Goals</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{data.stats.assists}</div>
                  <div className="text-sm text-neutral-600 mt-1">Assists</div>
                </div>
              </div>
            </div>
            
            {/* Career Timeline */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Career Timeline</h3>
              <div className="space-y-3">
                {data.careerTimeline.map((club, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-4 pb-3 border-b border-neutral-100 last:border-b-0"
                  >
                    <div className="w-12 h-12 bg-neutral-100 rounded flex-shrink-0 flex items-center justify-center text-2xl">
                      🏟️
                    </div>
                    <div className="flex-1">
                      <button 
                        onClick={() => onNavigate("team", index.toString())}
                        className="font-medium hover:text-blue-600 hover:underline"
                      >
                        {club.club}
                      </button>
                      <div className="text-sm text-neutral-600">{club.years}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{club.goals} goals</div>
                      <div className="text-neutral-600">{club.appearances} apps</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Awards */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Awards & Honours
              </h3>
              <div className="space-y-2">
                {data.awards.map((award, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded"
                  >
                    <span className="font-medium">{award.title}</span>
                    <span className="text-sm text-neutral-600">{award.year}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Recent Matches */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Recent Matches</h3>
              <div className="space-y-2">
                {data.recentMatches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => onNavigate("match", match.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 rounded border border-neutral-100"
                  >
                    <div className="text-left">
                      <div className="font-medium">vs {match.opponent}</div>
                      <div className="text-sm text-neutral-600">{match.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{match.result}</div>
                      <div className="text-sm text-neutral-600">{match.goals} goal{match.goals !== 1 ? 's' : ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Related Links */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Teammates</h3>
              <div className="space-y-2">
                {data.teammates.map((teammate) => (
                  <KnowledgeCard
                    key={teammate.id}
                    title={teammate.name}
                    subtitle={teammate.position}
                    size="compact"
                    onClick={() => onNavigate("player", teammate.id)}
                  />
                ))}
              </div>
            </div>
            
            {/* Quick Info */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Quick Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Birth Date</span>
                  <span className="font-medium">{data.birthDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Height</span>
                  <span className="font-medium">{data.height}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Current Team</span>
                  <button 
                    onClick={() => onNavigate("team", "1")}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {data.team}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
