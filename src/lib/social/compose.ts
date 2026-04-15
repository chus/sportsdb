const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";
const MAX_TWEET_LENGTH = 280;

export interface ArticleForSocial {
  slug: string;
  type: string;
  title: string;
  excerpt: string;
  // Joined from related tables
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  playerName?: string | null;
  playerGoals?: number | null;
  playerAssists?: number | null;
  competitionName?: string | null;
  competitionSlug?: string | null;
  matchday?: number | null;
}

function truncateToFit(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "\u2026";
}

function slugToHashtag(slug: string | null | undefined): string {
  if (!slug) return "";
  return "#" + slug.replace(/-/g, "").replace(/\s/g, "");
}

export function composeTweet(article: ArticleForSocial): string {
  const url = `${BASE_URL}/news/${article.slug}`;
  const hashtag = slugToHashtag(article.competitionSlug);

  let body: string;

  switch (article.type) {
    case "match_report": {
      const score =
        article.homeTeam && article.homeScore != null && article.awayScore != null
          ? `${article.homeTeam} ${article.homeScore}-${article.awayScore} ${article.awayTeam}`
          : "";
      body = score
        ? `${score}\n\n${article.excerpt}`
        : article.excerpt;
      break;
    }
    case "round_recap":
      body = article.competitionName && article.matchday
        ? `${article.competitionName} Matchday ${article.matchday} Recap\n\n${article.excerpt}`
        : article.excerpt;
      break;
    case "player_spotlight": {
      const stats = [
        article.playerGoals != null ? `${article.playerGoals}G` : null,
        article.playerAssists != null ? `${article.playerAssists}A` : null,
      ]
        .filter(Boolean)
        .join(" ");
      body = article.playerName
        ? `${article.playerName}${stats ? ` \u2014 ${stats} this season` : ""}\n\n${article.excerpt}`
        : article.excerpt;
      break;
    }
    case "match_preview":
      body =
        article.homeTeam && article.awayTeam
          ? `${article.homeTeam} vs ${article.awayTeam} Preview\n\n${article.excerpt}`
          : article.excerpt;
      break;
    default:
      body = article.excerpt;
  }

  const suffix = `\n\n${url}${hashtag ? ` ${hashtag}` : ""}`;
  const available = MAX_TWEET_LENGTH - suffix.length;
  return truncateToFit(body, available) + suffix;
}

export function composeRedditTitle(article: ArticleForSocial): string {
  switch (article.type) {
    case "match_report":
      if (article.homeTeam && article.homeScore != null && article.awayScore != null) {
        return `${article.homeTeam} ${article.homeScore}-${article.awayScore} ${article.awayTeam} — Match Report`;
      }
      return article.title;
    case "round_recap":
      return article.title;
    default:
      return article.title;
  }
}

const SUBREDDIT_MAP: Record<string, string> = {
  "premier-league": "PremierLeague",
  "la-liga": "LaLiga",
  "serie-a": "SerieA",
  "bundesliga": "Bundesliga",
  "ligue-1": "Ligue1",
  "uefa-champions-league": "ChampionsLeague",
  "uefa-europa-league": "EuropaLeague",
};

export function getSubreddit(competitionSlug: string | null): string | null {
  if (!competitionSlug) return "football";
  return SUBREDDIT_MAP[competitionSlug] || "football";
}
