import { ArrowLeft, Calendar, MapPin, Trophy, User } from "lucide-react";
import { KnowledgeCard } from "../KnowledgeCard";

interface MatchPageProps {
  matchId: string;
  onNavigate: (page: string, id?: string) => void;
  onBack: () => void;
}

export function MatchPage({ matchId, onNavigate, onBack }: MatchPageProps) {
  const matchData = {
    homeTeam: { id: "1", name: "Manchester City", logo: "MC" },
    awayTeam: { id: "2", name: "Liverpool", logo: "LIV" },
    homeScore: 2,
    awayScore: 1,
    date: "February 8, 2026",
    time: "16:30 GMT",
    venue: "Etihad Stadium",
    competition: "Premier League",
    attendance: "53,284",
    referee: "Michael Oliver",
    homeLineup: {
      formation: "4-3-3",
      starting: [
        { id: "1", name: "Ederson", number: 31, position: "GK" },
        { id: "2", name: "Kyle Walker", number: 2, position: "RB" },
        { id: "3", name: "Ruben Dias", number: 3, position: "CB" },
        { id: "4", name: "Nathan Ake", number: 6, position: "CB" },
        { id: "5", name: "Joao Cancelo", number: 7, position: "LB" },
        { id: "6", name: "Rodri", number: 16, position: "DM" },
        { id: "7", name: "Kevin De Bruyne", number: 17, position: "CM" },
        { id: "8", name: "Phil Foden", number: 47, position: "CM" },
        { id: "9", name: "Jack Grealish", number: 10, position: "LW" },
        { id: "10", name: "Erling Haaland", number: 9, position: "ST" },
        { id: "11", name: "Riyad Mahrez", number: 26, position: "RW" },
      ],
      substitutes: [
        { id: "12", name: "Julian Alvarez", number: 19, position: "FW" },
        { id: "13", name: "Bernardo Silva", number: 20, position: "MF" },
      ],
    },
    awayLineup: {
      formation: "4-3-3",
      starting: [
        { id: "21", name: "Alisson", number: 1, position: "GK" },
        { id: "22", name: "Trent Alexander-Arnold", number: 66, position: "RB" },
        { id: "23", name: "Virgil van Dijk", number: 4, position: "CB" },
        { id: "24", name: "Ibrahima Konate", number: 5, position: "CB" },
        { id: "25", name: "Andy Robertson", number: 26, position: "LB" },
        { id: "26", name: "Alexis Mac Allister", number: 10, position: "CM" },
        { id: "27", name: "Wataru Endo", number: 3, position: "DM" },
        { id: "28", name: "Curtis Jones", number: 17, position: "CM" },
        { id: "29", name: "Mohamed Salah", number: 11, position: "RW" },
        { id: "30", name: "Darwin Nunez", number: 9, position: "ST" },
        { id: "31", name: "Luis Diaz", number: 7, position: "LW" },
      ],
      substitutes: [
        { id: "32", name: "Diogo Jota", number: 20, position: "FW" },
        { id: "33", name: "Dominik Szoboszlai", number: 8, position: "MF" },
      ],
    },
    events: [
      { time: 12, type: "goal", team: "home", player: "Erling Haaland", assist: "Kevin De Bruyne" },
      { time: 23, type: "yellow", team: "away", player: "Wataru Endo" },
      { time: 34, type: "goal", team: "away", player: "Mohamed Salah", assist: "Trent Alexander-Arnold" },
      { time: 46, type: "substitution", team: "away", playerOut: "Curtis Jones", playerIn: "Dominik Szoboszlai" },
      { time: 67, type: "goal", team: "home", player: "Phil Foden", assist: "Jack Grealish" },
      { time: 72, type: "yellow", team: "home", player: "Rodri" },
      { time: 78, type: "substitution", team: "home", playerOut: "Erling Haaland", playerIn: "Julian Alvarez" },
    ],
  };
  
  const getEventIcon = (type: string) => {
    if (type === "goal") return "⚽";
    if (type === "yellow") return "🟨";
    if (type === "red") return "🟥";
    if (type === "substitution") return "🔄";
    return "•";
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
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Match Report</div>
              <h1 className="text-2xl font-bold">
                {matchData.homeTeam.name} vs {matchData.awayTeam.name}
              </h1>
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Score Card */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="text-center mb-6">
              <div className="text-sm text-neutral-600 mb-2">{matchData.competition}</div>
              <div className="flex items-center gap-2 justify-center text-sm text-neutral-600">
                <Calendar className="w-4 h-4" />
                {matchData.date} • {matchData.time}
              </div>
              <div className="flex items-center gap-2 justify-center text-sm text-neutral-600 mt-1">
                <MapPin className="w-4 h-4" />
                {matchData.venue}
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-8 md:gap-16 py-8">
              {/* Home Team */}
              <button 
                onClick={() => onNavigate("team", matchData.homeTeam.id)}
                className="text-center hover:opacity-80"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl md:text-3xl font-bold mb-3 mx-auto">
                  {matchData.homeTeam.logo}
                </div>
                <div className="font-semibold text-lg">{matchData.homeTeam.name}</div>
              </button>
              
              {/* Score */}
              <div className="text-center">
                <div className="text-5xl md:text-6xl font-bold">
                  {matchData.homeScore} - {matchData.awayScore}
                </div>
                <div className="text-sm text-neutral-600 mt-2">Full Time</div>
              </div>
              
              {/* Away Team */}
              <button 
                onClick={() => onNavigate("team", matchData.awayTeam.id)}
                className="text-center hover:opacity-80"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-red-600 rounded-full flex items-center justify-center text-white text-2xl md:text-3xl font-bold mb-3 mx-auto">
                  {matchData.awayTeam.logo}
                </div>
                <div className="font-semibold text-lg">{matchData.awayTeam.name}</div>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Events Timeline */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Match Events</h3>
              <div className="space-y-3">
                {matchData.events.map((event, index) => (
                  <div 
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded ${
                      event.team === "home" ? "bg-blue-50" : "bg-red-50"
                    }`}
                  >
                    <div className="text-sm font-bold text-neutral-600 w-8 flex-shrink-0">
                      {event.time}'
                    </div>
                    <div className="text-2xl flex-shrink-0">{getEventIcon(event.type)}</div>
                    <div className="flex-1 text-sm">
                      {event.type === "goal" && (
                        <>
                          <div className="font-semibold">{event.player}</div>
                          {event.assist && (
                            <div className="text-neutral-600">Assist: {event.assist}</div>
                          )}
                        </>
                      )}
                      {event.type === "yellow" && (
                        <div className="font-semibold">{event.player}</div>
                      )}
                      {event.type === "substitution" && (
                        <>
                          <div className="text-neutral-600">
                            <span className="font-medium">{event.playerIn}</span> on
                          </div>
                          <div className="text-neutral-600">
                            <span className="font-medium">{event.playerOut}</span> off
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Match Info */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Match Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-600">Competition</span>
                  <span className="font-medium">{matchData.competition}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-600">Date</span>
                  <span className="font-medium">{matchData.date}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-600">Kick-off</span>
                  <span className="font-medium">{matchData.time}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-600">Venue</span>
                  <span className="font-medium">{matchData.venue}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-600">Attendance</span>
                  <span className="font-medium">{matchData.attendance}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-neutral-600">Referee</span>
                  <span className="font-medium">{matchData.referee}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Lineups */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Home Lineup */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">
                {matchData.homeTeam.name} Lineup
                <span className="text-sm font-normal text-neutral-600 ml-2">
                  ({matchData.homeLineup.formation})
                </span>
              </h3>
              <div className="space-y-2 mb-4">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-3 py-1">
                  Starting XI
                </div>
                {matchData.homeLineup.starting.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate("player", player.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-neutral-50 rounded"
                  >
                    <div className="w-8 h-8 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {player.number}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{player.name}</div>
                    </div>
                    <div className="text-xs text-neutral-500">{player.position}</div>
                  </button>
                ))}
              </div>
              <div className="space-y-2 pt-4 border-t border-neutral-200">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-3 py-1">
                  Substitutes
                </div>
                {matchData.homeLineup.substitutes.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate("player", player.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-neutral-50 rounded"
                  >
                    <div className="w-8 h-8 border-2 border-blue-600 text-blue-600 rounded flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {player.number}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{player.name}</div>
                    </div>
                    <div className="text-xs text-neutral-500">{player.position}</div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Away Lineup */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">
                {matchData.awayTeam.name} Lineup
                <span className="text-sm font-normal text-neutral-600 ml-2">
                  ({matchData.awayLineup.formation})
                </span>
              </h3>
              <div className="space-y-2 mb-4">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-3 py-1">
                  Starting XI
                </div>
                {matchData.awayLineup.starting.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate("player", player.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-neutral-50 rounded"
                  >
                    <div className="w-8 h-8 bg-red-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {player.number}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{player.name}</div>
                    </div>
                    <div className="text-xs text-neutral-500">{player.position}</div>
                  </button>
                ))}
              </div>
              <div className="space-y-2 pt-4 border-t border-neutral-200">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-3 py-1">
                  Substitutes
                </div>
                {matchData.awayLineup.substitutes.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate("player", player.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-neutral-50 rounded"
                  >
                    <div className="w-8 h-8 border-2 border-red-600 text-red-600 rounded flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {player.number}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{player.name}</div>
                    </div>
                    <div className="text-xs text-neutral-500">{player.position}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
