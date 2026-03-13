export interface FaqItem {
  question: string;
  answer: string;
}

function articleFor(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function ordinal(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}

function surname(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function pronoun(position: string): { he: string; his: string; him: string } {
  // Default to he/his — football data doesn't carry gender info
  return { he: "he", his: "his", him: "him" };
}

function positionDescriptor(position: string): string {
  const lower = position.toLowerCase();
  if (lower === "forward") return "striker";
  if (lower === "goalkeeper") return "goalkeeper";
  if (lower === "defender") return "defender";
  if (lower === "midfielder") return "midfielder";
  return lower;
}

function teamLink(name: string, slug: string): string {
  return `[${name}](/teams/${slug})`;
}

function yearFromDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : String(d.getFullYear());
}

export function buildPlayerAbout(args: {
  name: string;
  knownAs?: string | null;
  nationality?: string | null;
  position: string;
  age?: number | null;
  currentTeamName?: string | null;
  currentTeamSlug?: string | null;
  career: Array<{
    teamName: string;
    teamSlug: string;
    validFrom: string | null;
    validTo: string | null;
  }>;
  currentSeasonStats?: {
    appearances: number;
    goals: number;
    assists: number;
    competition: string;
  } | null;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
}): string[] {
  const { he, his } = pronoun(args.position);
  const pos = positionDescriptor(args.position);
  const sn = surname(args.name);

  // --- Sentence 1: Notable descriptor lead-in ---
  let sentence1: string;
  const isGoalScorer =
    (args.position === "Forward" || args.position === "Midfielder") &&
    args.totalGoals >= 30;
  const isWellTravelled = args.career.length >= 5;
  const isYoung = args.age != null && args.age < 23;
  const isVeteran = args.age != null && args.age > 32;

  if (isGoalScorer && args.currentSeasonStats?.competition) {
    sentence1 = `One of the most prolific ${pos}s in ${args.currentSeasonStats.competition}, ${args.name} has scored ${args.totalGoals} goals in ${args.totalAppearances} career appearances.`;
  } else if (isWellTravelled) {
    sentence1 = `A well-travelled ${pos}, ${args.name} has represented ${args.career.length} clubs across ${his} career${args.totalAppearances > 0 ? `, registering ${args.totalGoals} goals and ${args.totalAssists} assists in ${args.totalAppearances} appearances` : ""}.`;
  } else if (isYoung && args.nationality) {
    sentence1 = `One of the brightest young talents in ${args.nationality} football, ${args.name} is ${articleFor(pos)} ${pos}${args.totalAppearances > 0 ? ` with ${args.totalAppearances} career appearances to ${his} name` : ""}.`;
  } else if (isVeteran && args.totalAppearances > 100) {
    sentence1 = `A seasoned ${pos} with over ${Math.floor(args.totalAppearances / 50) * 50} career appearances, ${args.name} has scored ${args.totalGoals} goals and provided ${args.totalAssists} assists across ${his} career.`;
  } else {
    const natDesc = args.nationality
      ? `${articleFor(args.nationality)} ${args.nationality} ${pos}`
      : `${articleFor(pos)} ${pos}`;
    if (args.totalAppearances > 0) {
      sentence1 = `${natDesc.charAt(0).toUpperCase() + natDesc.slice(1)}, ${args.name} has made ${args.totalAppearances} career appearances, scoring ${args.totalGoals} goals and providing ${args.totalAssists} assists.`;
    } else {
      sentence1 = `${args.name} is ${natDesc}.`;
    }
  }

  // --- Sentence 2: Career context ---
  let sentence2: string;
  const previousClubs = args.career.filter(
    (c) => c.validTo !== null
  );
  const currentClubFromCareer = args.career.find(
    (c) => c.validTo === null
  );

  if (args.currentTeamName && args.currentTeamSlug && previousClubs.length > 0) {
    const lastPrevious = previousClubs[previousClubs.length - 1];
    const joinYear = currentClubFromCareer
      ? yearFromDate(currentClubFromCareer.validFrom)
      : null;
    const joinClause = joinYear ? ` in ${joinYear}` : "";

    const currentLink = teamLink(args.currentTeamName, args.currentTeamSlug);
    const prevLink = teamLink(lastPrevious.teamName, lastPrevious.teamSlug);

    // Mention other notable clubs if they exist
    const otherPrev = previousClubs.slice(0, -1);
    if (otherPrev.length > 0) {
      const otherNames = otherPrev
        .slice(-3)
        .map((c) => teamLink(c.teamName, c.teamSlug))
        .join(", ");
      sentence2 = `The ${args.nationality || ""} international joined ${currentLink} from ${prevLink}${joinClause}, having previously played for ${otherNames}.`;
    } else {
      sentence2 = `${sn} joined ${currentLink} from ${prevLink}${joinClause}.`;
    }
  } else if (args.currentTeamName && args.currentTeamSlug && args.career.length === 1) {
    const currentLink = teamLink(args.currentTeamName, args.currentTeamSlug);
    sentence2 = `A product of ${currentLink}'s setup, ${he} has spent ${his} entire professional career at the club.`;
  } else if (args.currentTeamName && args.currentTeamSlug) {
    const currentLink = teamLink(args.currentTeamName, args.currentTeamSlug);
    sentence2 = `${sn} currently plays for ${currentLink}.`;
  } else if (args.career.length > 0) {
    sentence2 = `${sn}'s career has spanned ${args.career.length} club${args.career.length === 1 ? "" : "s"}.`;
  } else {
    sentence2 = "";
  }

  // --- Sentence 3: Current form ---
  let sentence3: string;
  if (
    args.currentSeasonStats &&
    args.currentSeasonStats.appearances > 0
  ) {
    const s = args.currentSeasonStats;
    sentence3 = `This season ${he} has ${s.goals} goal${s.goals !== 1 ? "s" : ""} and ${s.assists} assist${s.assists !== 1 ? "s" : ""} in ${s.appearances} appearance${s.appearances !== 1 ? "s" : ""} across ${s.competition}.`;
  } else if (args.totalAppearances > 0) {
    // Already covered stats in sentence1 for most paths, keep brief
    sentence3 = "";
  } else {
    sentence3 = "";
  }

  // Build paragraphs
  const para1 = [sentence1, sentence2].filter(Boolean).join(" ");
  const para2 = sentence3;

  return [para1, para2].filter(Boolean);
}

export function buildPlayerFaqs(args: {
  name: string;
  nationality?: string | null;
  position: string;
  currentTeamName?: string | null;
  age?: number | null;
  dateOfBirth?: string | null;
  preferredFoot?: string | null;
}) {
  const faqs: FaqItem[] = [
    {
      question: `Who is ${args.name}?`,
      answer: `${args.name} is ${articleFor(args.position.toLowerCase())} ${args.position.toLowerCase()}${args.nationality ? ` from ${args.nationality}` : ""}${args.currentTeamName ? ` who plays for ${args.currentTeamName}` : ""}.`,
    },
    {
      question: `What position does ${args.name} play?`,
      answer: `${args.name} plays as ${articleFor(args.position.toLowerCase())} ${args.position.toLowerCase()}.`,
    },
  ];

  if (args.currentTeamName) {
    faqs.push({
      question: `Which team does ${args.name} play for?`,
      answer: `${args.name} plays for ${args.currentTeamName}.`,
    });
  }

  if (args.age) {
    const dobClause =
      args.dateOfBirth
        ? `, born on ${new Date(args.dateOfBirth).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
        : "";
    faqs.push({
      question: `How old is ${args.name}?`,
      answer: `${args.name} is ${args.age} years old${dobClause}.`,
    });
  }

  if (args.preferredFoot) {
    faqs.push({
      question: `What is ${args.name}'s preferred foot?`,
      answer: `${args.name} is ${args.preferredFoot.toLowerCase()}-footed.`,
    });
  }

  return faqs;
}

export function buildTeamAbout(args: {
  name: string;
  shortName?: string | null;
  city?: string | null;
  country?: string | null;
  foundedYear?: number | null;
  squadSize: number;
  formerPlayersCount: number;
  seasonLabel?: string | null;
  competitionName?: string | null;
  standing?: {
    position: number;
    points: number;
    won: number;
    drawn: number;
    lost: number;
    goalDifference: number;
  } | null;
}): string[] {
  // --- Sentence 1: Identity + history ---
  const location = args.city && args.country
    ? `${args.city}, ${args.country}`
    : args.city || args.country || null;

  let sentence1: string;
  if (args.foundedYear && location) {
    sentence1 = `Founded in ${args.foundedYear}, ${args.name} are a football club based in ${location}.`;
  } else if (location) {
    sentence1 = `${args.name} are a football club based in ${location}.`;
  } else if (args.foundedYear) {
    sentence1 = `Founded in ${args.foundedYear}, ${args.name} are a professional football club.`;
  } else {
    sentence1 = `${args.name} are a professional football club.`;
  }

  // --- Sentence 2: Current standing ---
  let sentence2: string;
  const compLabel = args.competitionName || args.seasonLabel || "the league";
  if (args.standing && args.seasonLabel) {
    sentence2 = `They currently sit ${ordinal(args.standing.position)} in the ${compLabel} with ${args.standing.points} points from a ${args.standing.won}W-${args.standing.drawn}D-${args.standing.lost}L record this season.`;
  } else {
    sentence2 = `The club carries a ${args.squadSize}-player squad for the current campaign.`;
  }

  // --- Sentence 3: Squad context ---
  let sentence3: string;
  if (args.standing) {
    // Already mentioned standing, add squad context
    sentence3 = `The squad features ${args.squadSize} players${args.formerPlayersCount > 0 ? `, with ${args.formerPlayersCount} former players having represented the club in recent seasons` : ""}.`;
  } else if (args.formerPlayersCount > 0) {
    sentence3 = `${args.formerPlayersCount} former players have represented the club in recent seasons.`;
  } else {
    sentence3 = "";
  }

  const para1 = [sentence1, sentence2].join(" ");
  const para2 = sentence3;

  return [para1, para2].filter(Boolean);
}

export function buildTeamFaqs(args: {
  name: string;
  city?: string | null;
  country?: string | null;
  foundedYear?: number | null;
  squadSize: number;
  seasonLabel?: string | null;
  competitionName?: string | null;
  standing?: {
    position: number;
    points: number;
  } | null;
}) {
  const faqs: FaqItem[] = [];

  if (args.country) {
    faqs.push({
      question: `What country is ${args.name} from?`,
      answer: args.city
        ? `${args.name} are based in ${args.city}, ${args.country}.`
        : `${args.name} are based in ${args.country}.`,
    });
  }

  if (args.foundedYear) {
    faqs.push({
      question: `When was ${args.name} founded?`,
      answer: `${args.name} were founded in ${args.foundedYear}.`,
    });
  }

  faqs.push({
    question: `How big is the ${args.name} squad?`,
    answer: `${args.name}'s current squad has ${args.squadSize} player${args.squadSize === 1 ? "" : "s"}.`,
  });

  if (args.standing && args.seasonLabel) {
    const label = args.competitionName || args.seasonLabel;
    faqs.push({
      question: `What is ${args.name}'s current league position?`,
      answer: `${args.name} are ${ordinal(args.standing.position)} in the ${label} with ${args.standing.points} points.`,
    });
  }

  return faqs;
}
