import { ArrowLeft, Star, TrendingUp, Award, Users, Calendar, MapPin, Sparkles } from "lucide-react";
import { useState } from "react";
import { TimeToggle } from "../TimeToggle";
import { KnowledgeCard } from "../KnowledgeCard";

interface PlayerPageEnhancedProps {
  playerId: string;
  onNavigate: (page: string, id?: string) => void;
  onBack: () => void;
}

export function PlayerPageEnhanced({ playerId, onNavigate, onBack }: PlayerPageEnhancedProps) {
  const [timeView, setTimeView] = useState<"now" | "historical">("now");
  const [selectedSeason, setSelectedSeason] = useState("2025/26");
  
  const playerData = {
    name: "Erling Haaland",
    knownAs: "Haaland",
    position: "Forward",
    team: "Manchester City",
    nationality: "Norway",
    age: 25,
    birthDate: "July 21, 2000",
    height: "1.95m",
    shirtNumber: 9,
    status: "Active",
    imageUrl: "https://images.unsplash.com/photo-1764842262144-e58d386299ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMHBsYXllciUyMHBvcnRyYWl0JTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc3MDcyNjAyNXww&ixlib=rb-4.1.0&q=80&w=1080",
    careerStats: {
      appearances: 340,
      goals: 295,
      assists: 68,
      nationalCaps: 38,
      trophiesWon: 12
    },
    seasonStats: {
      appearances: 28,
      goals: 32,
      assists: 8,
    },
    careerTimeline: [
      { id: "1", club: "Manchester City", years: "2022 - Present", from: 2022, to: null, appearances: 102, goals: 105 },
      { id: "2", club: "Borussia Dortmund", years: "2020 - 2022", from: 2020, to: 2022, appearances: 89, goals: 86 },
      { id: "3", club: "RB Salzburg", years: "2019 - 2020", from: 2019, to: 2020, appearances: 27, goals: 29 },
      { id: "4", club: "Molde FK", years: "2017 - 2019", from: 2017, to: 2019, appearances: 50, goals: 20 },
    ],
    honours: [
      { title: "Premier League", season: "2024/25", logo: "🏆" },
      { title: "Premier League Golden Boot", season: "2024/25", logo: "⚽" },
      { title: "Champions League", season: "2022/23", logo: "🏆" },
      { title: "PFA Player of the Year", season: "2023/24", logo: "⭐" },
    ],
    recentMatches: [
      { id: "1", opponent: "Liverpool", result: "W 2-1", goals: 1, assists: 0, date: "Feb 8, 2026", competition: "Premier League" },
      { id: "2", opponent: "Arsenal", result: "D 1-1", goals: 1, assists: 0, date: "Feb 1, 2026", competition: "Premier League" },
      { id: "3", opponent: "Chelsea", result: "W 3-0", goals: 2, assists: 1, date: "Jan 25, 2026", competition: "Premier League" },
    ],
    teammates: [
      { id: "2", name: "Phil Foden", position: "Midfielder", imageUrl: "" },
      { id: "3", name: "Kevin De Bruyne", position: "Midfielder", imageUrl: "" },
      { id: "4", name: "Jack Grealish", position: "Winger", imageUrl: "" },
    ],
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Compact Navigation */}
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
        {/* Background with gradient */}
        <div className="absolute inset-0">
          <img 
            src={playerData.imageUrl}
            alt={playerData.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative h-full max-w-7xl mx-auto px-4 flex items-end pb-12">
          <div className="max-w-4xl">
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 backdrop-blur-sm border border-green-400/30 rounded-full mb-4">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-sm font-semibold text-green-100">{playerData.status}</span>
            </div>

            {/* Name */}
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
              {playerData.name}
            </h1>

            {/* Key Info */}
            <div className="flex flex-wrap items-center gap-4 text-white/90 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">
                  {playerData.shirtNumber}
                </div>
                <span className="font-medium">{playerData.position}</span>
              </div>
              <div className="w-1 h-1 bg-white/40 rounded-full" />
              <button 
                onClick={() => onNavigate("team", "1")}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-xs">⚽</div>
                <span className="font-medium">{playerData.team}</span>
              </button>
              <div className="w-1 h-1 bg-white/40 rounded-full" />
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{playerData.nationality}</span>
              </div>
              <div className="w-1 h-1 bg-white/40 rounded-full" />
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{playerData.age} years old</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <button className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-all flex items-center gap-2">
                <Star className="w-5 h-5" />
                Follow Player
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Time Toggle */}
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
            {/* Season Stats */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold">Season Performance</h2>
                {timeView === "historical" && (
                  <span className="text-sm text-neutral-500">({selectedSeason})</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">{playerData.seasonStats.appearances}</div>
                  <div className="text-sm text-neutral-600">Appearances</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">{playerData.seasonStats.goals}</div>
                  <div className="text-sm text-neutral-600">Goals</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">{playerData.seasonStats.assists}</div>
                  <div className="text-sm text-neutral-600">Assists</div>
                </div>
              </div>
            </div>

            {/* Career Timeline */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">Career Timeline</h2>
              <div className="space-y-6">
                {playerData.careerTimeline.map((club, index) => (
                  <div key={club.id} className="relative">
                    {/* Timeline Line */}
                    {index !== playerData.careerTimeline.length - 1 && (
                      <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gradient-to-b from-blue-600 to-blue-200" />
                    )}
                    
                    <button
                      onClick={() => onNavigate("team", club.id)}
                      className="w-full flex items-start gap-4 p-4 hover:bg-neutral-50 rounded-xl transition-colors group"
                    >
                      {/* Club Crest */}
                      <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-105 transition-transform flex-shrink-0">
                        {club.club.substring(0, 2).toUpperCase()}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 text-left">
                        <div className="font-bold text-lg text-neutral-900 group-hover:text-blue-600 transition-colors">
                          {club.club}
                        </div>
                        <div className="text-sm text-neutral-600 mb-2">{club.years}</div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-neutral-700">
                            <span className="font-semibold">{club.appearances}</span> apps
                          </span>
                          <span className="text-neutral-700">
                            <span className="font-semibold text-blue-600">{club.goals}</span> goals
                          </span>
                        </div>
                      </div>
                      
                      {/* Current Badge */}
                      {club.to === null && (
                        <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          Current
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Honours */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Award className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-bold">Honours & Awards</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {playerData.honours.map((honour, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-4 p-4 bg-gradient-to-br from-neutral-50 to-white border border-neutral-200 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="text-4xl">{honour.logo}</div>
                    <div>
                      <div className="font-semibold text-neutral-900">{honour.title}</div>
                      <div className="text-sm text-neutral-600">{honour.season}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Matches */}
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">Recent Matches</h2>
              <div className="space-y-3">
                {playerData.recentMatches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => onNavigate("match", match.id)}
                    className="w-full flex items-center justify-between p-4 bg-neutral-50 hover:bg-neutral-100 rounded-xl transition-colors border border-neutral-200"
                  >
                    <div className="text-left">
                      <div className="font-semibold text-neutral-900">vs {match.opponent}</div>
                      <div className="text-sm text-neutral-600">{match.competition} • {match.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{match.result}</div>
                      <div className="text-sm text-neutral-600">
                        {match.goals > 0 && `${match.goals} goal${match.goals !== 1 ? 's' : ''}`}
                        {match.assists > 0 && match.goals > 0 && ', '}
                        {match.assists > 0 && `${match.assists} assist${match.assists !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Career Stats Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-lg">Career Statistics</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-blue-100">Appearances</span>
                  <span className="text-2xl font-bold">{playerData.careerStats.appearances}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-blue-100">Goals</span>
                  <span className="text-2xl font-bold">{playerData.careerStats.goals}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-blue-100">Assists</span>
                  <span className="text-2xl font-bold">{playerData.careerStats.assists}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-blue-100">National Caps</span>
                  <span className="text-2xl font-bold">{playerData.careerStats.nationalCaps}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-100">Trophies</span>
                  <span className="text-2xl font-bold">{playerData.careerStats.trophiesWon}</span>
                </div>
              </div>
            </div>

            {/* Teammates */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg">Current Teammates</h3>
              </div>
              <div className="space-y-2">
                {playerData.teammates.map((teammate) => (
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

            {/* Player Info */}
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Player Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Birth Date</span>
                  <span className="font-medium">{playerData.birthDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Height</span>
                  <span className="font-medium">{playerData.height}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Nationality</span>
                  <span className="font-medium">{playerData.nationality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Current Club</span>
                  <button 
                    onClick={() => onNavigate("team", "1")}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {playerData.team}
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
