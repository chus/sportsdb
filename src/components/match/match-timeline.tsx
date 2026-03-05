import Link from "next/link";

interface TimelineEvent {
  id: string;
  type: string;
  minute: number;
  addedTime: number | null;
  teamId: string;
  player: { name: string; slug: string } | null;
  secondaryPlayer: { name: string; slug: string } | null;
}

interface MatchTimelineProps {
  events: TimelineEvent[];
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
}

function getEventEmoji(type: string): string {
  switch (type) {
    case "goal":
      return "\u26BD";
    case "own_goal":
      return "\u26BD";
    case "penalty":
      return "\u26BD";
    case "penalty_missed":
      return "\u274C";
    case "yellow_card":
      return "\uD83D\uDFE8";
    case "red_card":
      return "\uD83D\uDFE5";
    case "substitution":
      return "\uD83D\uDD04";
    default:
      return "\u2022";
  }
}

function getEventAccentClass(type: string): string {
  switch (type) {
    case "goal":
    case "own_goal":
    case "penalty":
      return "border-green-500 bg-green-50";
    case "penalty_missed":
      return "border-red-400 bg-red-50";
    case "yellow_card":
      return "border-yellow-400 bg-yellow-50";
    case "red_card":
      return "border-red-500 bg-red-50";
    case "substitution":
      return "border-blue-400 bg-blue-50";
    default:
      return "border-neutral-300 bg-neutral-50";
  }
}

function EventDetail({ event }: { event: TimelineEvent }) {
  const minuteStr = event.addedTime
    ? `${event.minute}+${event.addedTime}'`
    : `${event.minute}'`;

  if (event.type === "goal" || event.type === "own_goal" || event.type === "penalty") {
    return (
      <span className="text-sm">
        <span className="font-semibold text-neutral-900">
          {event.player ? (
            <Link
              href={`/players/${event.player.slug}`}
              className="hover:text-blue-600 transition-colors"
            >
              {event.player.name}
            </Link>
          ) : (
            "Unknown"
          )}
        </span>
        {event.type === "own_goal" && (
          <span className="text-red-500 ml-1">(OG)</span>
        )}
        {event.type === "penalty" && (
          <span className="text-neutral-500 ml-1">(pen.)</span>
        )}
        {event.secondaryPlayer && (
          <span className="text-neutral-500">
            {" "}
            (assist:{" "}
            <Link
              href={`/players/${event.secondaryPlayer.slug}`}
              className="text-neutral-600 hover:text-blue-600 transition-colors"
            >
              {event.secondaryPlayer.name}
            </Link>
            )
          </span>
        )}
      </span>
    );
  }

  if (event.type === "penalty_missed") {
    return (
      <span className="text-sm">
        <span className="font-semibold text-neutral-900">
          {event.player ? (
            <Link
              href={`/players/${event.player.slug}`}
              className="hover:text-blue-600 transition-colors"
            >
              {event.player.name}
            </Link>
          ) : (
            "Unknown"
          )}
        </span>
        <span className="text-red-500 ml-1">(pen. missed)</span>
      </span>
    );
  }

  if (event.type === "yellow_card" || event.type === "red_card") {
    return (
      <span className="text-sm font-semibold text-neutral-900">
        {event.player ? (
          <Link
            href={`/players/${event.player.slug}`}
            className="hover:text-blue-600 transition-colors"
          >
            {event.player.name}
          </Link>
        ) : (
          "Unknown"
        )}
      </span>
    );
  }

  if (event.type === "substitution") {
    return (
      <span className="text-sm">
        <span className="text-green-600 font-medium">
          {event.player ? (
            <Link
              href={`/players/${event.player.slug}`}
              className="hover:text-green-700 transition-colors"
            >
              {event.player.name}
            </Link>
          ) : (
            "Unknown"
          )}{" "}
        </span>
        <span className="text-neutral-400">{"\u2194"}</span>{" "}
        <span className="text-red-500 font-medium">
          {event.secondaryPlayer ? (
            <Link
              href={`/players/${event.secondaryPlayer.slug}`}
              className="hover:text-red-600 transition-colors"
            >
              {event.secondaryPlayer.name}
            </Link>
          ) : (
            "Unknown"
          )}
        </span>
      </span>
    );
  }

  return (
    <span className="text-sm text-neutral-700">
      {event.player?.name || "Event"}
    </span>
  );
}

export function MatchTimeline({
  events,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
}: MatchTimelineProps) {
  if (events.length === 0) return null;

  // Check if we need a half-time divider
  const hasFirstHalf = events.some((e) => e.minute <= 45);
  const hasSecondHalf = events.some((e) => e.minute > 45);
  const showHalfTime = hasFirstHalf && hasSecondHalf;

  // Build event list with optional half-time marker
  type TimelineItem =
    | { kind: "event"; event: TimelineEvent }
    | { kind: "halftime" };

  const items: TimelineItem[] = [];
  let halfTimeInserted = false;

  for (const event of events) {
    if (showHalfTime && !halfTimeInserted && event.minute > 45) {
      items.push({ kind: "halftime" });
      halfTimeInserted = true;
    }
    items.push({ kind: "event", event });
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">Match Timeline</h2>
      </div>

      {/* Desktop: center-line layout */}
      <div className="hidden md:block px-6 py-4">
        {/* Team headers */}
        <div className="flex items-center mb-4 pb-2 border-b border-neutral-100">
          <div className="flex-1 text-sm font-semibold text-neutral-700 text-right pr-6">
            {homeTeamName}
          </div>
          <div className="w-12" />
          <div className="flex-1 text-sm font-semibold text-neutral-700 text-left pl-6">
            {awayTeamName}
          </div>
        </div>

        <div className="relative">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-neutral-200 -translate-x-1/2" />

          {items.map((item, idx) => {
            if (item.kind === "halftime") {
              return (
                <div key="ht" className="flex items-center py-3">
                  <div className="flex-1 h-px bg-neutral-300" />
                  <div className="mx-3 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-300 text-xs font-semibold text-neutral-500">
                    HT
                  </div>
                  <div className="flex-1 h-px bg-neutral-300" />
                </div>
              );
            }

            const { event } = item;
            const isHome = event.teamId === homeTeamId;
            const emoji = getEventEmoji(event.type);
            const accentClass = getEventAccentClass(event.type);
            const minuteStr = event.addedTime
              ? `${event.minute}+${event.addedTime}'`
              : `${event.minute}'`;

            return (
              <div key={event.id} className="flex items-center py-1.5">
                {/* Home side */}
                <div className="flex-1 flex justify-end pr-4">
                  {isHome && (
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${accentClass}`}
                    >
                      <span>{emoji}</span>
                      <EventDetail event={event} />
                    </div>
                  )}
                </div>

                {/* Center minute circle */}
                <div className="w-12 flex items-center justify-center z-10">
                  <div className="w-10 h-7 rounded-full bg-white border-2 border-neutral-300 flex items-center justify-center">
                    <span className="text-xs font-bold text-neutral-600">
                      {minuteStr}
                    </span>
                  </div>
                </div>

                {/* Away side */}
                <div className="flex-1 flex justify-start pl-4">
                  {!isHome && (
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${accentClass}`}
                    >
                      <span>{emoji}</span>
                      <EventDetail event={event} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: single column */}
      <div className="md:hidden px-4 py-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-neutral-200" />

          <div className="space-y-0">
            {items.map((item, idx) => {
              if (item.kind === "halftime") {
                return (
                  <div key="ht" className="flex items-center gap-3 py-3 pl-1">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center z-10">
                      <span className="text-xs font-semibold text-neutral-500">
                        HT
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-neutral-300" />
                  </div>
                );
              }

              const { event } = item;
              const isHome = event.teamId === homeTeamId;
              const emoji = getEventEmoji(event.type);
              const accentClass = getEventAccentClass(event.type);
              const minuteStr = event.addedTime
                ? `${event.minute}+${event.addedTime}'`
                : `${event.minute}'`;

              return (
                <div key={event.id} className="flex items-start gap-3 py-1.5 pl-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0 border-2 ${accentClass}`}
                  >
                    <span className="text-sm">{emoji}</span>
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-500 w-10">
                        {minuteStr}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {isHome ? homeTeamName : awayTeamName}
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <EventDetail event={event} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
