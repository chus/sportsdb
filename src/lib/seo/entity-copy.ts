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

function formatMarketValue(valueEur: number): string {
  if (valueEur >= 1_000_000) {
    const millions = valueEur / 1_000_000;
    return `€${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (valueEur >= 1_000) return `€${(valueEur / 1_000).toFixed(0)}K`;
  return `€${valueEur.toLocaleString()}`;
}

function positionDescriptor(position: string): string {
  const lower = position.toLowerCase();
  if (lower === "forward") return "striker";
  if (lower === "goalkeeper") return "goalkeeper";
  if (lower === "defender") return "defender";
  if (lower === "midfielder") return "midfielder";
  return lower;
}

function positionDescriptorEs(position: string): string {
  const lower = position.toLowerCase();
  if (lower === "forward") return "delantero";
  if (lower === "goalkeeper") return "portero";
  if (lower === "defender") return "defensa";
  if (lower === "midfielder") return "centrocampista";
  return "futbolista";
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
  marketValueEur?: number | null;
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

  // --- Sentence 4: Market value ---
  let sentence4 = "";
  if (args.marketValueEur) {
    sentence4 = `${sn}'s current market value is estimated at ${formatMarketValue(args.marketValueEur)}.`;
  }

  // Build paragraphs
  const para1 = [sentence1, sentence2].filter(Boolean).join(" ");
  const para2 = [sentence3, sentence4].filter(Boolean).join(" ");

  return [para1, para2].filter(Boolean);
}

/**
 * Spanish version of buildPlayerAbout. Intentionally simpler than the
 * English version — uses one consistent template instead of mirroring the
 * 5-way conditional sentence variants. Reads naturally and conveys all
 * the structured data; users browsing /es get translated body content
 * without us having to handle Spanish gender/number across 20+ templates.
 */
export function buildPlayerAboutEs(args: Parameters<typeof buildPlayerAbout>[0]): string[] {
  const pos = positionDescriptorEs(args.position);
  const sn = surname(args.name);
  const sentences: string[] = [];

  // --- Sentence 1: identity ---
  // Spanish grammar: "portero de Uruguay" (preposition + country) rather than
  // adjective ("uruguayo") which would require per-country forms. The "de NN
  // años" age clause goes after the nationality.
  const natBit = args.nationality ? ` de ${args.nationality}` : "";
  const ageBit = args.age != null ? `, de ${args.age} años` : "";
  if (args.totalAppearances > 0) {
    sentences.push(
      `${args.name} es un ${pos}${natBit}${ageBit}, con ${args.totalAppearances} partidos de carrera, ${args.totalGoals} goles y ${args.totalAssists} asistencias.`,
    );
  } else {
    sentences.push(`${args.name} es un ${pos}${natBit}${ageBit}.`);
  }

  // --- Sentence 2: current team + transfer narrative ---
  const previousClubs = args.career.filter((c) => c.validTo !== null);
  const currentClubFromCareer = args.career.find((c) => c.validTo === null);

  if (args.currentTeamName && args.currentTeamSlug && previousClubs.length > 0) {
    const lastPrevious = previousClubs[previousClubs.length - 1];
    const joinYear = currentClubFromCareer
      ? yearFromDate(currentClubFromCareer.validFrom)
      : null;
    const joinClause = joinYear ? ` en ${joinYear}` : "";
    const currentLink = teamLink(args.currentTeamName, args.currentTeamSlug);
    const prevLink = teamLink(lastPrevious.teamName, lastPrevious.teamSlug);
    sentences.push(`${sn} se incorporó a ${currentLink} desde ${prevLink}${joinClause}.`);
  } else if (args.currentTeamName && args.currentTeamSlug && args.career.length === 1) {
    const currentLink = teamLink(args.currentTeamName, args.currentTeamSlug);
    sentences.push(`Formado en ${currentLink}, ha desarrollado allí toda su carrera profesional.`);
  } else if (args.currentTeamName && args.currentTeamSlug) {
    const currentLink = teamLink(args.currentTeamName, args.currentTeamSlug);
    sentences.push(`Actualmente juega en ${currentLink}.`);
  } else if (args.career.length > 0) {
    const plural = args.career.length === 1 ? "club" : "clubes";
    sentences.push(`Su carrera ha pasado por ${args.career.length} ${plural}.`);
  }

  // --- Sentence 3: current season ---
  let para2Sentences: string[] = [];
  if (args.currentSeasonStats && args.currentSeasonStats.appearances > 0) {
    const s = args.currentSeasonStats;
    const goalsWord = s.goals === 1 ? "gol" : "goles";
    const assistsWord = s.assists === 1 ? "asistencia" : "asistencias";
    const appsWord = s.appearances === 1 ? "partido" : "partidos";
    para2Sentences.push(
      `Esta temporada acumula ${s.goals} ${goalsWord} y ${s.assists} ${assistsWord} en ${s.appearances} ${appsWord} en ${s.competition}.`,
    );
  }

  // --- Sentence 4: market value ---
  if (args.marketValueEur) {
    para2Sentences.push(
      `Su valor de mercado actual se estima en ${formatMarketValue(args.marketValueEur)}.`,
    );
  }

  const para1 = sentences.join(" ");
  const para2 = para2Sentences.join(" ");
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
  totalGoals?: number;
  totalAssists?: number;
  totalApps?: number;
  heightCm?: number | null;
  careerTeams?: string[];
  marketValueEur?: number | null;
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

  if (args.totalApps && args.totalApps > 0) {
    faqs.push({
      question: `How many goals has ${args.name} scored?`,
      answer: `${args.name} has scored ${args.totalGoals ?? 0} goals and provided ${args.totalAssists ?? 0} assists in ${args.totalApps} career appearances.`,
    });
  }

  if (args.heightCm) {
    const feet = Math.floor(args.heightCm / 30.48);
    const inches = Math.round((args.heightCm % 30.48) / 2.54);
    faqs.push({
      question: `How tall is ${args.name}?`,
      answer: `${args.name} is ${args.heightCm} cm (${feet}'${inches}") tall.`,
    });
  }

  if (args.careerTeams && args.careerTeams.length > 1) {
    faqs.push({
      question: `Which clubs has ${args.name} played for?`,
      answer: `${args.name} has played for ${args.careerTeams.join(", ")}.`,
    });
  }

  if (args.marketValueEur) {
    faqs.push({
      question: `What is ${args.name}'s market value?`,
      answer: `${args.name}'s current estimated market value is ${formatMarketValue(args.marketValueEur)}.`,
    });
  }

  return faqs;
}

export function buildPlayerFaqsEs(args: Parameters<typeof buildPlayerFaqs>[0]): FaqItem[] {
  const pos = positionDescriptorEs(args.position);
  const faqs: FaqItem[] = [
    {
      question: `¿Quién es ${args.name}?`,
      answer: `${args.name} es un ${pos}${args.nationality ? ` de ${args.nationality}` : ""}${args.currentTeamName ? ` que juega en ${args.currentTeamName}` : ""}.`,
    },
    {
      question: `¿En qué posición juega ${args.name}?`,
      answer: `${args.name} juega como ${pos}.`,
    },
  ];

  if (args.currentTeamName) {
    faqs.push({
      question: `¿En qué equipo juega ${args.name}?`,
      answer: `${args.name} juega en ${args.currentTeamName}.`,
    });
  }

  if (args.age) {
    const dobClause = args.dateOfBirth
      ? `, nacido el ${new Date(args.dateOfBirth).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`
      : "";
    faqs.push({
      question: `¿Cuántos años tiene ${args.name}?`,
      answer: `${args.name} tiene ${args.age} años${dobClause}.`,
    });
  }

  if (args.preferredFoot) {
    const foot = args.preferredFoot.toLowerCase() === "right" ? "derecho"
      : args.preferredFoot.toLowerCase() === "left" ? "izquierdo"
      : "ambidiestro";
    faqs.push({
      question: `¿Cuál es el pie preferido de ${args.name}?`,
      answer: `${args.name} es ${foot}.`,
    });
  }

  if (args.totalApps && args.totalApps > 0) {
    faqs.push({
      question: `¿Cuántos goles ha marcado ${args.name}?`,
      answer: `${args.name} ha marcado ${args.totalGoals ?? 0} goles y ha dado ${args.totalAssists ?? 0} asistencias en ${args.totalApps} partidos de carrera.`,
    });
  }

  if (args.heightCm) {
    faqs.push({
      question: `¿Cuánto mide ${args.name}?`,
      answer: `${args.name} mide ${args.heightCm} cm.`,
    });
  }

  if (args.careerTeams && args.careerTeams.length > 1) {
    faqs.push({
      question: `¿En qué clubes ha jugado ${args.name}?`,
      answer: `${args.name} ha jugado en ${args.careerTeams.join(", ")}.`,
    });
  }

  if (args.marketValueEur) {
    faqs.push({
      question: `¿Cuál es el valor de mercado de ${args.name}?`,
      answer: `El valor de mercado actual estimado de ${args.name} es ${formatMarketValue(args.marketValueEur)}.`,
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
    played?: number;
    goalsFor?: number;
    goalsAgainst?: number;
    form?: string | null;
  } | null;
  leaderName?: string | null;
  leaderPoints?: number | null;
  topScorer?: { name: string; goals: number } | null;
  venueName?: string | null;
  venueCapacity?: number | null;
  coachName?: string | null;
  squadMarketValue?: number | null;
}): string[] {
  // Guard: skip city if it looks like a number (data quality bug)
  const safeCity = args.city && !/^\d+$/.test(args.city) ? args.city : null;
  const location = safeCity && args.country
    ? `${safeCity}, ${args.country}`
    : safeCity || args.country || null;

  // --- Paragraph 1: Identity + history ---
  let identity: string;
  if (args.foundedYear && location) {
    identity = `Founded in ${args.foundedYear}, ${args.name} are a football club based in ${location}.`;
  } else if (location) {
    identity = `${args.name} are a football club based in ${location}.`;
  } else if (args.foundedYear) {
    identity = `Founded in ${args.foundedYear}, ${args.name} are a professional football club.`;
  } else {
    identity = `${args.name} are a professional football club.`;
  }

  const compLabel = args.competitionName || "the league";
  let competition = "";
  if (args.competitionName && args.seasonLabel) {
    competition = ` They compete in the ${args.competitionName} for the ${args.seasonLabel} season.`;
  } else if (args.competitionName) {
    competition = ` They compete in the ${args.competitionName}.`;
  }

  const para1 = identity + competition;

  // --- Paragraph 2: Current standing + context ---
  let standingText = "";
  if (args.standing && args.seasonLabel) {
    const s = args.standing;
    const posText = `${ordinal(s.position)} in the ${compLabel}`;
    const gdText = s.goalDifference > 0 ? `+${s.goalDifference}` : String(s.goalDifference);

    standingText = `${args.name} currently sit ${posText} with ${s.points} points from a ${s.won}W-${s.drawn}D-${s.lost}L record (GD: ${gdText}).`;

    // Add gap-to-leader context if not 1st
    if (s.position > 1 && args.leaderName && args.leaderPoints != null) {
      const gap = args.leaderPoints - s.points;
      if (gap > 0) {
        standingText += ` They trail leaders ${args.leaderName} by ${gap} point${gap !== 1 ? "s" : ""}.`;
      }
    } else if (s.position === 1) {
      standingText += ` They lead the table.`;
    }

    // Form context
    if (s.form && s.form.length >= 3) {
      const formArr = s.form.split("");
      const recent5 = formArr.slice(-5);
      const wins = recent5.filter((f) => f === "W").length;
      const unbeaten = recent5.filter((f) => f === "W" || f === "D").length;
      if (wins >= 4) {
        standingText += ` Their recent form has been excellent, winning ${wins} of their last ${recent5.length} matches.`;
      } else if (unbeaten === recent5.length) {
        standingText += ` They are unbeaten in their last ${recent5.length} matches.`;
      } else if (wins <= 1) {
        standingText += ` Form has been a concern, with just ${wins} win in their last ${recent5.length} outings.`;
      }
    }
  }

  const para2 = standingText;

  // --- Paragraph 3: Top scorer + squad + coach + value ---
  const parts3: string[] = [];
  if (args.coachName) {
    parts3.push(`The team is managed by ${args.coachName}.`);
  }
  if (args.topScorer && args.topScorer.goals > 0) {
    parts3.push(
      `${args.topScorer.name} leads the scoring charts for the club with ${args.topScorer.goals} goal${args.topScorer.goals !== 1 ? "s" : ""} this season.`
    );
  }
  if (args.squadSize > 0) {
    const valueSuffix = args.squadMarketValue
      ? `, valued at a combined ${formatMarketValue(args.squadMarketValue)}`
      : "";
    parts3.push(
      `The first-team squad comprises ${args.squadSize} players${valueSuffix}${args.formerPlayersCount > 0 ? `, with ${args.formerPlayersCount} former players having represented the club in recent seasons` : ""}.`
    );
  }
  const para3 = parts3.join(" ");

  // --- Paragraph 4: Venue ---
  let para4 = "";
  if (args.venueName) {
    if (args.venueCapacity) {
      para4 = `${args.name} play their home matches at ${args.venueName}, which has a capacity of ${args.venueCapacity.toLocaleString()} spectators.`;
    } else {
      para4 = `${args.name} play their home matches at ${args.venueName}.`;
    }
  }

  return [para1, para2, para3, para4].filter(Boolean);
}

export function buildTeamAboutEs(args: Parameters<typeof buildTeamAbout>[0]): string[] {
  const safeCity = args.city && !/^\d+$/.test(args.city) ? args.city : null;
  const location = safeCity && args.country
    ? `${safeCity}, ${args.country}`
    : safeCity || args.country || null;

  // --- Paragraph 1: Identity ---
  let identity: string;
  if (args.foundedYear && location) {
    identity = `Fundado en ${args.foundedYear}, ${args.name} es un club de fútbol con sede en ${location}.`;
  } else if (location) {
    identity = `${args.name} es un club de fútbol con sede en ${location}.`;
  } else if (args.foundedYear) {
    identity = `Fundado en ${args.foundedYear}, ${args.name} es un club de fútbol profesional.`;
  } else {
    identity = `${args.name} es un club de fútbol profesional.`;
  }

  let competition = "";
  if (args.competitionName && args.seasonLabel) {
    competition = ` Compite en ${args.competitionName} en la temporada ${args.seasonLabel}.`;
  } else if (args.competitionName) {
    competition = ` Compite en ${args.competitionName}.`;
  }

  const para1 = identity + competition;

  // --- Paragraph 2: Current standing ---
  let standingText = "";
  if (args.standing && args.seasonLabel) {
    const s = args.standing;
    const compLabel = args.competitionName || "la liga";
    const gdText = s.goalDifference > 0 ? `+${s.goalDifference}` : String(s.goalDifference);
    standingText = `${args.name} ocupa actualmente el puesto ${s.position} en ${compLabel} con ${s.points} puntos y un balance de ${s.won}V-${s.drawn}E-${s.lost}D (DG: ${gdText}).`;

    if (s.position > 1 && args.leaderName && args.leaderPoints != null) {
      const gap = args.leaderPoints - s.points;
      if (gap > 0) {
        const ptsWord = gap === 1 ? "punto" : "puntos";
        standingText += ` Está a ${gap} ${ptsWord} del líder ${args.leaderName}.`;
      }
    } else if (s.position === 1) {
      standingText += " Lidera la tabla.";
    }

    if (s.form && s.form.length >= 3) {
      const formArr = s.form.split("");
      const recent5 = formArr.slice(-5);
      const wins = recent5.filter((f) => f === "W").length;
      const unbeaten = recent5.filter((f) => f === "W" || f === "D").length;
      if (wins >= 4) {
        standingText += ` Su forma reciente es excelente, con ${wins} victorias en sus últimos ${recent5.length} partidos.`;
      } else if (unbeaten === recent5.length) {
        standingText += ` Lleva ${recent5.length} partidos invicto.`;
      } else if (wins <= 1) {
        const winsWord = wins === 1 ? "victoria" : "victorias";
        standingText += ` La forma es preocupante, con solo ${wins} ${winsWord} en sus últimos ${recent5.length} partidos.`;
      }
    }
  }

  const para2 = standingText;

  // --- Paragraph 3: Coach + top scorer + squad ---
  const parts3: string[] = [];
  if (args.coachName) {
    parts3.push(`El equipo está dirigido por ${args.coachName}.`);
  }
  if (args.topScorer && args.topScorer.goals > 0) {
    const goalsWord = args.topScorer.goals === 1 ? "gol" : "goles";
    parts3.push(
      `${args.topScorer.name} es el máximo goleador del club esta temporada con ${args.topScorer.goals} ${goalsWord}.`,
    );
  }
  if (args.squadSize > 0) {
    const valueSuffix = args.squadMarketValue
      ? `, valorada en ${formatMarketValue(args.squadMarketValue)}`
      : "";
    const formerClause = args.formerPlayersCount > 0
      ? `, con ${args.formerPlayersCount} exjugadores que han representado al club en temporadas recientes`
      : "";
    parts3.push(
      `La plantilla del primer equipo cuenta con ${args.squadSize} jugadores${valueSuffix}${formerClause}.`,
    );
  }
  const para3 = parts3.join(" ");

  // --- Paragraph 4: Venue ---
  let para4 = "";
  if (args.venueName) {
    if (args.venueCapacity) {
      para4 = `${args.name} disputa sus partidos como local en ${args.venueName}, con capacidad para ${args.venueCapacity.toLocaleString("es-ES")} espectadores.`;
    } else {
      para4 = `${args.name} disputa sus partidos como local en ${args.venueName}.`;
    }
  }

  return [para1, para2, para3, para4].filter(Boolean);
}

export function buildCompetitionAbout(args: {
  name: string;
  country?: string | null;
  type?: string | null;
  seasonLabel?: string | null;
  teamCount: number;
  leader?: { name: string; points: number } | null;
  topScorer?: { name: string; goals: number; teamName: string } | null;
}): string[] {
  // --- Paragraph 1: Identity ---
  let sentence1: string;
  if (args.country) {
    sentence1 = `The ${args.name} is the top-flight football ${args.type === "cup" ? "cup competition" : "league"} in ${args.country}.`;
  } else {
    sentence1 = `The ${args.name} is ${articleFor(args.type || "league")} ${args.type === "cup" ? "cup competition" : "professional football league"}.`;
  }

  let sentence2: string;
  if (args.seasonLabel && args.teamCount > 0) {
    sentence2 = `The ${args.seasonLabel} season features ${args.teamCount} teams competing for the title.`;
  } else if (args.teamCount > 0) {
    sentence2 = `The current campaign features ${args.teamCount} teams.`;
  } else {
    sentence2 = "";
  }

  // --- Paragraph 2: Current state ---
  let sentence3: string;
  if (args.leader && args.topScorer) {
    sentence3 = `${args.leader.name} lead the standings with ${args.leader.points} points, while ${args.topScorer.name} (${args.topScorer.teamName}) tops the scoring charts with ${args.topScorer.goals} goal${args.topScorer.goals !== 1 ? "s" : ""}.`;
  } else if (args.leader) {
    sentence3 = `${args.leader.name} currently lead the standings with ${args.leader.points} points.`;
  } else if (args.topScorer) {
    sentence3 = `${args.topScorer.name} (${args.topScorer.teamName}) leads the scoring with ${args.topScorer.goals} goal${args.topScorer.goals !== 1 ? "s" : ""}.`;
  } else {
    sentence3 = "";
  }

  const para1 = [sentence1, sentence2].filter(Boolean).join(" ");
  const para2 = sentence3;

  return [para1, para2].filter(Boolean);
}

export function buildVenueAbout(args: {
  name: string;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  openedYear?: number | null;
  currentTeamNames: string[];
  historicalTeamCount: number;
  recentMatchCount: number;
  upcomingMatchCount: number;
}): string[] {
  // --- Paragraph 1: Identity ---
  const location = args.city && args.country
    ? `${args.city}, ${args.country}`
    : args.city || args.country || null;

  let sentence1: string;
  if (location && args.openedYear) {
    sentence1 = `${args.name} is a football stadium located in ${location}, opened in ${args.openedYear}.`;
  } else if (location) {
    sentence1 = `${args.name} is a football stadium located in ${location}.`;
  } else {
    sentence1 = `${args.name} is a professional football stadium.`;
  }

  let sentence2: string;
  if (args.capacity) {
    sentence2 = `The venue has a capacity of ${args.capacity.toLocaleString()} spectators.`;
  } else {
    sentence2 = "";
  }

  // --- Paragraph 2: Teams and activity ---
  let sentence3: string;
  if (args.currentTeamNames.length === 1) {
    sentence3 = `It serves as the home ground for ${args.currentTeamNames[0]}.`;
  } else if (args.currentTeamNames.length > 1) {
    sentence3 = `The stadium is shared by ${args.currentTeamNames.join(" and ")}.`;
  } else {
    sentence3 = "";
  }

  let sentence4: string;
  const totalMatches = args.recentMatchCount + args.upcomingMatchCount;
  if (totalMatches > 0 && args.historicalTeamCount > 0) {
    sentence4 = `${totalMatches} matches are scheduled or have been played at the venue recently, and ${args.historicalTeamCount} former clubs have called it home.`;
  } else if (totalMatches > 0) {
    sentence4 = `${totalMatches} matches are scheduled or have been played at the venue recently.`;
  } else if (args.historicalTeamCount > 0) {
    sentence4 = `${args.historicalTeamCount} clubs have previously called it home.`;
  } else {
    sentence4 = "";
  }

  const para1 = [sentence1, sentence2].filter(Boolean).join(" ");
  const para2 = [sentence3, sentence4].filter(Boolean).join(" ");

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
  venueName?: string | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  standing?: {
    position: number;
    points: number;
  } | null;
  coachName?: string | null;
  squadMarketValue?: number | null;
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

  if (args.venueName) {
    faqs.push({
      question: `What stadium does ${args.name} play at?`,
      answer: `${args.name} play their home matches at ${args.venueName}.`,
    });
  }

  if (args.goalsFor != null && args.goalsAgainst != null && args.seasonLabel) {
    const label = args.competitionName || args.seasonLabel;
    faqs.push({
      question: `How many goals have ${args.name} scored this season?`,
      answer: `${args.name} have scored ${args.goalsFor} goals and conceded ${args.goalsAgainst} in the ${label} this season.`,
    });
  }

  if (args.coachName) {
    faqs.push({
      question: `Who is the manager of ${args.name}?`,
      answer: `${args.name} are managed by ${args.coachName}.`,
    });
  }

  if (args.squadMarketValue) {
    faqs.push({
      question: `What is ${args.name}'s squad market value?`,
      answer: `${args.name}'s current squad is valued at approximately ${formatMarketValue(args.squadMarketValue)}.`,
    });
  }

  return faqs;
}

export function buildTeamFaqsEs(args: Parameters<typeof buildTeamFaqs>[0]): FaqItem[] {
  const faqs: FaqItem[] = [];

  if (args.country) {
    faqs.push({
      question: `¿De qué país es ${args.name}?`,
      answer: args.city
        ? `${args.name} tiene su sede en ${args.city}, ${args.country}.`
        : `${args.name} tiene su sede en ${args.country}.`,
    });
  }

  if (args.foundedYear) {
    faqs.push({
      question: `¿Cuándo fue fundado ${args.name}?`,
      answer: `${args.name} fue fundado en ${args.foundedYear}.`,
    });
  }

  const playerWord = args.squadSize === 1 ? "jugador" : "jugadores";
  faqs.push({
    question: `¿Qué tamaño tiene la plantilla de ${args.name}?`,
    answer: `La plantilla actual de ${args.name} tiene ${args.squadSize} ${playerWord}.`,
  });

  if (args.standing && args.seasonLabel) {
    const label = args.competitionName || args.seasonLabel;
    faqs.push({
      question: `¿Cuál es la posición actual de ${args.name} en la liga?`,
      answer: `${args.name} ocupa el puesto ${args.standing.position} en ${label} con ${args.standing.points} puntos.`,
    });
  }

  if (args.venueName) {
    faqs.push({
      question: `¿En qué estadio juega ${args.name}?`,
      answer: `${args.name} disputa sus partidos como local en ${args.venueName}.`,
    });
  }

  if (args.goalsFor != null && args.goalsAgainst != null && args.seasonLabel) {
    const label = args.competitionName || args.seasonLabel;
    faqs.push({
      question: `¿Cuántos goles ha marcado ${args.name} esta temporada?`,
      answer: `${args.name} ha marcado ${args.goalsFor} goles y ha encajado ${args.goalsAgainst} en ${label} esta temporada.`,
    });
  }

  if (args.coachName) {
    faqs.push({
      question: `¿Quién es el entrenador de ${args.name}?`,
      answer: `${args.name} está dirigido por ${args.coachName}.`,
    });
  }

  if (args.squadMarketValue) {
    faqs.push({
      question: `¿Cuál es el valor de mercado de la plantilla de ${args.name}?`,
      answer: `La plantilla actual de ${args.name} está valorada en aproximadamente ${formatMarketValue(args.squadMarketValue)}.`,
    });
  }

  return faqs;
}

export function buildCompetitionFaqs(args: {
  name: string;
  country?: string | null;
  teamCount: number;
  seasonLabel?: string | null;
  leader?: { name: string; points: number } | null;
  topScorer?: { name: string; goals: number; teamName: string } | null;
}) {
  const faqs: FaqItem[] = [];

  if (args.teamCount > 0) {
    faqs.push({
      question: `How many teams are in the ${args.name}?`,
      answer: `The ${args.name}${args.seasonLabel ? ` ${args.seasonLabel} season` : ""} has ${args.teamCount} teams.`,
    });
  }

  if (args.leader && args.seasonLabel) {
    faqs.push({
      question: `Who is top of the ${args.name}?`,
      answer: `${args.leader.name} lead the ${args.name} with ${args.leader.points} points in the ${args.seasonLabel} season.`,
    });
  }

  if (args.topScorer) {
    faqs.push({
      question: `Who is the top scorer in the ${args.name}?`,
      answer: `${args.topScorer.name} (${args.topScorer.teamName}) is the leading scorer in the ${args.name} with ${args.topScorer.goals} goal${args.topScorer.goals !== 1 ? "s" : ""}.`,
    });
  }

  if (args.country) {
    faqs.push({
      question: `Which country is the ${args.name} in?`,
      answer: `The ${args.name} is the top-flight football league in ${args.country}.`,
    });
  }

  return faqs;
}

export function buildVenueFaqs(args: {
  name: string;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  openedYear?: number | null;
  homeTeamNames?: string[];
}) {
  const faqs: FaqItem[] = [];

  if (args.city || args.country) {
    const location = args.city && args.country
      ? `${args.city}, ${args.country}`
      : args.city || args.country;
    faqs.push({
      question: `Where is ${args.name} located?`,
      answer: `${args.name} is located in ${location}.`,
    });
  }

  if (args.capacity) {
    faqs.push({
      question: `What is the capacity of ${args.name}?`,
      answer: `${args.name} has a capacity of ${args.capacity.toLocaleString()} spectators.`,
    });
  }

  if (args.homeTeamNames && args.homeTeamNames.length > 0) {
    faqs.push({
      question: `Which teams play at ${args.name}?`,
      answer: args.homeTeamNames.length === 1
        ? `${args.homeTeamNames[0]} play their home matches at ${args.name}.`
        : `${args.name} is home to ${args.homeTeamNames.join(" and ")}.`,
    });
  }

  if (args.openedYear) {
    faqs.push({
      question: `When was ${args.name} built?`,
      answer: `${args.name} was opened in ${args.openedYear}.`,
    });
  }

  return faqs;
}

export function buildCompetitionAboutEs(args: Parameters<typeof buildCompetitionAbout>[0]): string[] {
  let sentence1: string;
  const compType = args.type === "cup" ? "competición de copa" : "liga";
  if (args.country) {
    sentence1 = `La ${args.name} es la principal ${compType} de fútbol de ${args.country}.`;
  } else {
    sentence1 = `La ${args.name} es una ${compType} profesional de fútbol.`;
  }

  let sentence2 = "";
  if (args.seasonLabel && args.teamCount > 0) {
    sentence2 = `La temporada ${args.seasonLabel} cuenta con ${args.teamCount} equipos compitiendo por el título.`;
  } else if (args.teamCount > 0) {
    sentence2 = `La temporada actual cuenta con ${args.teamCount} equipos.`;
  }

  let sentence3 = "";
  const goalsWord = (n: number) => (n === 1 ? "gol" : "goles");
  if (args.leader && args.topScorer) {
    sentence3 = `${args.leader.name} lidera la clasificación con ${args.leader.points} puntos, mientras que ${args.topScorer.name} (${args.topScorer.teamName}) encabeza la tabla de goleadores con ${args.topScorer.goals} ${goalsWord(args.topScorer.goals)}.`;
  } else if (args.leader) {
    sentence3 = `${args.leader.name} lidera actualmente la clasificación con ${args.leader.points} puntos.`;
  } else if (args.topScorer) {
    sentence3 = `${args.topScorer.name} (${args.topScorer.teamName}) lidera la tabla de goleadores con ${args.topScorer.goals} ${goalsWord(args.topScorer.goals)}.`;
  }

  const para1 = [sentence1, sentence2].filter(Boolean).join(" ");
  return [para1, sentence3].filter(Boolean);
}

export function buildCompetitionFaqsEs(args: Parameters<typeof buildCompetitionFaqs>[0]): FaqItem[] {
  const faqs: FaqItem[] = [];

  if (args.teamCount > 0) {
    faqs.push({
      question: `¿Cuántos equipos hay en ${args.name}?`,
      answer: `${args.name}${args.seasonLabel ? ` en la temporada ${args.seasonLabel}` : ""} tiene ${args.teamCount} equipos.`,
    });
  }

  if (args.leader && args.seasonLabel) {
    faqs.push({
      question: `¿Quién lidera ${args.name}?`,
      answer: `${args.leader.name} lidera ${args.name} con ${args.leader.points} puntos en la temporada ${args.seasonLabel}.`,
    });
  }

  if (args.topScorer) {
    const goalsWord = args.topScorer.goals === 1 ? "gol" : "goles";
    faqs.push({
      question: `¿Quién es el máximo goleador de ${args.name}?`,
      answer: `${args.topScorer.name} (${args.topScorer.teamName}) es el máximo goleador de ${args.name} con ${args.topScorer.goals} ${goalsWord}.`,
    });
  }

  if (args.country) {
    faqs.push({
      question: `¿En qué país se disputa ${args.name}?`,
      answer: `${args.name} es la principal liga de fútbol de ${args.country}.`,
    });
  }

  return faqs;
}

export function buildVenueAboutEs(args: Parameters<typeof buildVenueAbout>[0]): string[] {
  const location = args.city && args.country
    ? `${args.city}, ${args.country}`
    : args.city || args.country || null;

  let sentence1: string;
  if (location && args.openedYear) {
    sentence1 = `${args.name} es un estadio de fútbol situado en ${location}, inaugurado en ${args.openedYear}.`;
  } else if (location) {
    sentence1 = `${args.name} es un estadio de fútbol situado en ${location}.`;
  } else {
    sentence1 = `${args.name} es un estadio de fútbol profesional.`;
  }

  let sentence2 = "";
  if (args.capacity) {
    sentence2 = `El recinto tiene una capacidad de ${args.capacity.toLocaleString("es-ES")} espectadores.`;
  }

  let sentence3 = "";
  if (args.currentTeamNames.length === 1) {
    sentence3 = `Es la sede del ${args.currentTeamNames[0]}.`;
  } else if (args.currentTeamNames.length > 1) {
    sentence3 = `El estadio es compartido por ${args.currentTeamNames.join(" y ")}.`;
  }

  let sentence4 = "";
  const totalMatches = args.recentMatchCount + args.upcomingMatchCount;
  if (totalMatches > 0 && args.historicalTeamCount > 0) {
    sentence4 = `Se han disputado o están programados ${totalMatches} partidos recientes en el estadio, y ${args.historicalTeamCount} clubes lo han tenido como sede en el pasado.`;
  } else if (totalMatches > 0) {
    sentence4 = `Se han disputado o están programados ${totalMatches} partidos recientes en el estadio.`;
  } else if (args.historicalTeamCount > 0) {
    sentence4 = `${args.historicalTeamCount} clubes lo han tenido como sede en el pasado.`;
  }

  const para1 = [sentence1, sentence2].filter(Boolean).join(" ");
  const para2 = [sentence3, sentence4].filter(Boolean).join(" ");
  return [para1, para2].filter(Boolean);
}

export function buildVenueFaqsEs(args: Parameters<typeof buildVenueFaqs>[0]): FaqItem[] {
  const faqs: FaqItem[] = [];

  if (args.city || args.country) {
    const location = args.city && args.country
      ? `${args.city}, ${args.country}`
      : args.city || args.country;
    faqs.push({
      question: `¿Dónde está situado ${args.name}?`,
      answer: `${args.name} está situado en ${location}.`,
    });
  }

  if (args.capacity) {
    faqs.push({
      question: `¿Cuál es la capacidad de ${args.name}?`,
      answer: `${args.name} tiene una capacidad de ${args.capacity.toLocaleString("es-ES")} espectadores.`,
    });
  }

  if (args.homeTeamNames && args.homeTeamNames.length > 0) {
    faqs.push({
      question: `¿Qué equipos juegan en ${args.name}?`,
      answer: args.homeTeamNames.length === 1
        ? `${args.homeTeamNames[0]} disputa sus partidos como local en ${args.name}.`
        : `${args.name} es la sede de ${args.homeTeamNames.join(" y ")}.`,
    });
  }

  if (args.openedYear) {
    faqs.push({
      question: `¿Cuándo se construyó ${args.name}?`,
      answer: `${args.name} fue inaugurado en ${args.openedYear}.`,
    });
  }

  return faqs;
}
