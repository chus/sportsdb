export interface FaqItem {
  question: string;
  answer: string;
}

function withPeriod(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function articleFor(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

export function buildPlayerAbout(args: {
  name: string;
  knownAs?: string | null;
  nationality?: string | null;
  secondNationality?: string | null;
  position: string;
  currentTeamName?: string | null;
  shirtNumber?: number | null;
  age?: number | null;
  heightCm?: number | null;
  preferredFoot?: string | null;
  status?: string | null;
  careerClubCount: number;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
}) {
  const descriptor = [args.nationality, args.position.toLowerCase()].filter(Boolean).join(" ");
  const intro = descriptor
    ? `${args.name}${args.knownAs && args.knownAs !== args.name ? `, also known as ${args.knownAs},` : ""} is ${articleFor(descriptor)} ${descriptor}.`
    : `${args.name} is a football player.`;

  const currentTeamSentence = args.currentTeamName
    ? `SportsDB currently lists ${args.name} with ${args.currentTeamName}${args.shirtNumber ? ` wearing number ${args.shirtNumber}` : ""}.`
    : `SportsDB does not currently list an active club assignment for ${args.name}.`;

  const profileFacts = [
    args.age ? `${args.name} is ${args.age} years old` : null,
    args.heightCm ? `stands ${args.heightCm} cm tall` : null,
    args.preferredFoot ? `prefers the ${args.preferredFoot.toLowerCase()} foot` : null,
    args.secondNationality ? `also has ${args.secondNationality} nationality` : null,
    args.status && args.status !== "active" ? `is currently marked as ${args.status}` : null,
  ].filter(Boolean);

  const summaryLine = profileFacts.length > 0 ? `${withPeriod(profileFacts.join(", "))}` : null;

  const performanceSentence =
    args.totalAppearances > 0
      ? `${args.name} has ${args.totalAppearances} recorded appearances, ${args.totalGoals} goals, and ${args.totalAssists} assists across tracked season statistics on SportsDB.`
      : `${args.name}'s profile currently focuses on bio and team history, with limited season stat coverage in the dataset.`;

  const careerSentence =
    args.careerClubCount > 0
      ? `${args.name}'s recorded career history currently spans ${args.careerClubCount} club${args.careerClubCount === 1 ? "" : "s"}.`
      : `Career history entries for ${args.name} are still limited in the current dataset.`;

  return [
    [intro, currentTeamSentence, summaryLine].filter(Boolean).join(" "),
    `${performanceSentence} ${careerSentence}`,
  ];
}

export function buildPlayerFaqs(args: {
  name: string;
  nationality?: string | null;
  position: string;
  currentTeamName?: string | null;
  age?: number | null;
  preferredFoot?: string | null;
}) {
  const faqs: FaqItem[] = [
    {
      question: `Who is ${args.name}?`,
      answer: `${args.name} is a football player listed on SportsDB as a ${args.position.toLowerCase()}${args.nationality ? ` from ${args.nationality}` : ""}.`,
    },
    {
      question: `What position does ${args.name} play?`,
      answer: `${args.name} plays as ${articleFor(args.position.toLowerCase())} ${args.position.toLowerCase()}.`,
    },
  ];

  if (args.currentTeamName) {
    faqs.push({
      question: `Which team does ${args.name} play for?`,
      answer: `SportsDB currently lists ${args.name} with ${args.currentTeamName}.`,
    });
  }

  if (args.age) {
    faqs.push({
      question: `How old is ${args.name}?`,
      answer: `${args.name} is ${args.age} years old based on the birth date available on SportsDB.`,
    });
  }

  if (args.preferredFoot) {
    faqs.push({
      question: `What is ${args.name}'s preferred foot?`,
      answer: `${args.name}'s preferred foot is listed as ${args.preferredFoot.toLowerCase()}.`,
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
  standing?: {
    position: number;
    points: number;
    won: number;
    drawn: number;
    lost: number;
    goalDifference: number;
  } | null;
}) {
  const location = args.city && args.country
    ? `${args.city}, ${args.country}`
    : args.city || args.country || null;

  const identitySentence = `${args.name}${args.shortName && args.shortName !== args.name ? ` (${args.shortName})` : ""} is a football club${location ? ` based in ${location}` : ""}${args.foundedYear ? `, founded in ${args.foundedYear}` : ""}.`;
  const squadSentence = `SportsDB currently lists ${args.squadSize} player${args.squadSize === 1 ? "" : "s"} in the active squad view for ${args.name}.`;

  const performanceSentence = args.standing && args.seasonLabel
    ? `In the tracked ${args.seasonLabel} season, ${args.name} sits ${ordinal(args.standing.position)} with ${args.standing.points} points and a ${args.standing.won}-${args.standing.drawn}-${args.standing.lost} record.`
    : `The team page includes squad listings, fixtures, related coverage, and club information for ${args.name}.`;

  const historySentence = args.formerPlayersCount > 0
    ? `SportsDB also links ${args.name} to ${args.formerPlayersCount} recent former player${args.formerPlayersCount === 1 ? "" : "s"}.`
    : `Former player history for ${args.name} is still limited in the current dataset.`;

  return [
    `${identitySentence} ${squadSentence}`,
    `${performanceSentence} ${historySentence}`,
  ];
}

export function buildTeamFaqs(args: {
  name: string;
  city?: string | null;
  country?: string | null;
  foundedYear?: number | null;
  squadSize: number;
  seasonLabel?: string | null;
  standing?: {
    position: number;
    points: number;
  } | null;
}) {
  const faqs: FaqItem[] = [];

  if (args.country) {
    faqs.push({
      question: `What country is ${args.name} from?`,
      answer: `${args.name} is listed on SportsDB in ${args.country}${args.city ? `, with ${args.city} recorded as the club's city` : ""}.`,
    });
  }

  if (args.foundedYear) {
    faqs.push({
      question: `When was ${args.name} founded?`,
      answer: `${args.name} was founded in ${args.foundedYear} according to the club profile on SportsDB.`,
    });
  }

  faqs.push({
    question: `How big is the ${args.name} squad?`,
    answer: `The current squad view for ${args.name} contains ${args.squadSize} player${args.squadSize === 1 ? "" : "s"} on SportsDB.`,
  });

  if (args.standing && args.seasonLabel) {
    faqs.push({
      question: `What is ${args.name}'s current league position?`,
      answer: `In the tracked ${args.seasonLabel} table, ${args.name} is ${ordinal(args.standing.position)} with ${args.standing.points} points.`,
    });
  }

  return faqs;
}

function ordinal(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}
