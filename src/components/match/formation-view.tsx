import Link from "next/link";

interface Player {
  id: string;
  name: string;
  slug: string;
  position: string | null;
  shirtNumber: number | null;
}

interface FormationViewProps {
  homeTeam: {
    name: string;
    shortName?: string | null;
    primaryColor?: string | null;
    players: Player[];
  };
  awayTeam: {
    name: string;
    shortName?: string | null;
    primaryColor?: string | null;
    players: Player[];
  };
}

// Position mapping to grid coordinates (5 rows x 5 cols)
const POSITION_MAP: Record<string, { row: number; col: number }> = {
  // Goalkeeper
  GK: { row: 0, col: 2 },

  // Defenders
  LB: { row: 1, col: 0 },
  CB: { row: 1, col: 2 },
  RB: { row: 1, col: 4 },
  LWB: { row: 1, col: 0 },
  RWB: { row: 1, col: 4 },

  // Defensive Midfielders
  CDM: { row: 2, col: 2 },
  DM: { row: 2, col: 2 },

  // Midfielders
  LM: { row: 2, col: 0 },
  CM: { row: 2, col: 2 },
  RM: { row: 2, col: 4 },

  // Attacking Midfielders
  CAM: { row: 3, col: 2 },
  AM: { row: 3, col: 2 },
  LAM: { row: 3, col: 1 },
  RAM: { row: 3, col: 3 },

  // Wingers
  LW: { row: 3, col: 0 },
  RW: { row: 3, col: 4 },

  // Forwards
  CF: { row: 4, col: 2 },
  ST: { row: 4, col: 2 },
  LF: { row: 4, col: 1 },
  RF: { row: 4, col: 3 },
};

// Fallback position detection from general position
function getPositionFromGeneral(position: string | null, index: number): string {
  if (!position) return "CM";

  const pos = position.toLowerCase();
  if (pos.includes("goal")) return "GK";
  if (pos.includes("defend")) {
    // Distribute defenders
    const defPositions = ["LB", "CB", "CB", "RB"];
    return defPositions[index % defPositions.length];
  }
  if (pos.includes("midfield")) {
    const midPositions = ["LM", "CM", "CM", "RM"];
    return midPositions[index % midPositions.length];
  }
  if (pos.includes("forward") || pos.includes("attack")) {
    const fwdPositions = ["LW", "ST", "RW"];
    return fwdPositions[index % fwdPositions.length];
  }
  return "CM";
}

function PlayerMarker({
  player,
  color,
  isHome,
}: {
  player: Player;
  color: string;
  isHome: boolean;
}) {
  return (
    <Link
      href={`/players/${player.slug}`}
      className="group flex flex-col items-center"
      title={player.name}
    >
      <div
        className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-bold shadow-lg group-hover:scale-110 transition-transform"
        style={{ backgroundColor: color }}
      >
        {player.shirtNumber || "?"}
      </div>
      <span className="text-[10px] md:text-xs text-white font-medium mt-1 text-center max-w-[60px] truncate opacity-90 group-hover:opacity-100">
        {player.name.split(" ").pop()}
      </span>
    </Link>
  );
}

function TeamFormation({
  team,
  isHome,
}: {
  team: FormationViewProps["homeTeam"];
  isHome: boolean;
}) {
  const color = team.primaryColor || (isHome ? "#2563eb" : "#dc2626");

  // Group players by position rows
  const starters = team.players.filter((p) => p.position !== null).slice(0, 11);

  // Create a 5-row grid
  const rows: Player[][] = [[], [], [], [], []];
  let defenderCount = 0;
  let midfielderCount = 0;
  let forwardCount = 0;

  starters.forEach((player) => {
    let posCode = player.position?.toUpperCase() || "CM";

    // If position is a general position (Goalkeeper, Defender, etc.), map it
    if (!POSITION_MAP[posCode]) {
      if (posCode.includes("GOAL")) {
        posCode = "GK";
      } else if (posCode.includes("DEFEND")) {
        posCode = getPositionFromGeneral("Defender", defenderCount++);
      } else if (posCode.includes("MIDFIELD")) {
        posCode = getPositionFromGeneral("Midfielder", midfielderCount++);
      } else if (posCode.includes("FORWARD") || posCode.includes("ATTACK")) {
        posCode = getPositionFromGeneral("Forward", forwardCount++);
      } else {
        posCode = "CM";
      }
    }

    const pos = POSITION_MAP[posCode] || { row: 2, col: 2 };
    rows[pos.row].push(player);
  });

  return (
    <div className="relative h-full flex flex-col justify-between py-4 px-2">
      {/* Flip rows for away team (attacking the other way) */}
      {(isHome ? rows : [...rows].reverse()).map((rowPlayers, rowIndex) => (
        <div
          key={rowIndex}
          className="flex justify-around items-center"
          style={{ minHeight: "20%" }}
        >
          {rowPlayers.map((player) => (
            <PlayerMarker
              key={player.id}
              player={player}
              color={color}
              isHome={isHome}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FormationView({ homeTeam, awayTeam }: FormationViewProps) {
  const hasLineups = homeTeam.players.length > 0 && awayTeam.players.length > 0;

  if (!hasLineups) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900">Formations</h3>
      </div>

      <div className="relative">
        {/* Pitch background */}
        <div
          className="relative h-[500px] md:h-[600px]"
          style={{
            background: "linear-gradient(to bottom, #2d8a2d 0%, #3d9a3d 50%, #2d8a2d 100%)",
          }}
        >
          {/* Pitch markings */}
          <div className="absolute inset-0">
            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 md:w-32 md:h-32 border-2 border-white/30 rounded-full" />
            {/* Center line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30" />
            {/* Center spot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full" />

            {/* Goal areas - Home (top) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 md:w-40 h-12 md:h-16 border-2 border-t-0 border-white/30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 md:w-20 h-6 md:h-8 border-2 border-t-0 border-white/30" />

            {/* Goal areas - Away (bottom) */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 md:w-40 h-12 md:h-16 border-2 border-b-0 border-white/30" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 md:w-20 h-6 md:h-8 border-2 border-b-0 border-white/30" />
          </div>

          {/* Team labels */}
          <div className="absolute top-2 left-2 right-2 flex justify-between">
            <span className="text-xs text-white/70 font-medium">
              {homeTeam.shortName || homeTeam.name}
            </span>
          </div>
          <div className="absolute bottom-2 left-2 right-2 flex justify-between">
            <span className="text-xs text-white/70 font-medium">
              {awayTeam.shortName || awayTeam.name}
            </span>
          </div>

          {/* Split into two halves */}
          <div className="absolute inset-0 grid grid-rows-2">
            {/* Home team (top half, attacking down) */}
            <div className="relative">
              <TeamFormation team={homeTeam} isHome={true} />
            </div>

            {/* Away team (bottom half, attacking up) */}
            <div className="relative">
              <TeamFormation team={awayTeam} isHome={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
