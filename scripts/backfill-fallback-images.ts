import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { buildFallbackEntityImageUrl } from "../src/lib/images/fallback-entity-image";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co").replace(/\/$/, "");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`Fallback image backfill (${dryRun ? "dry run" : "live"})`);
  console.log(`Base URL: ${BASE_URL}`);

  await backfillPlayers();
  await backfillTeams();
  await backfillCompetitions();
  await backfillVenues();
  await backfillArticles();
}

async function backfillPlayers() {
  const players = await sql.query(`
    select id, name, slug
    from players
    where image_url is null or image_url = ''
    order by popularity_score desc nulls last, name asc
  `);

  console.log(`Players missing images: ${players.length}`);

  if (dryRun) {
    for (const player of players.slice(0, 5)) {
      console.log(
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "player",
          name: player.name,
          seed: player.slug,
        })
      );
    }
    return;
  }

  for (const player of players) {
    await sql.query(
      "update players set image_url = $1, updated_at = now() where id = $2",
      [
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "player",
          name: player.name,
          seed: player.slug,
        }),
        player.id,
      ]
    );
  }
}

async function backfillTeams() {
  const teams = await sql.query(`
    select id, name, slug
    from teams
    where logo_url is null or logo_url = ''
    order by tier asc, name asc
  `);

  console.log(`Teams missing logos: ${teams.length}`);

  if (dryRun) {
    for (const team of teams.slice(0, 5)) {
      console.log(
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "team",
          name: team.name,
          seed: team.slug,
        })
      );
    }
    return;
  }

  for (const team of teams) {
    await sql.query(
      "update teams set logo_url = $1, updated_at = now() where id = $2",
      [
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "team",
          name: team.name,
          seed: team.slug,
        }),
        team.id,
      ]
    );
  }
}

async function backfillCompetitions() {
  const competitions = await sql.query(`
    select id, name, slug
    from competitions
    where logo_url is null or logo_url = ''
    order by name asc
  `);

  console.log(`Competitions missing logos: ${competitions.length}`);

  if (dryRun) {
    for (const competition of competitions.slice(0, 5)) {
      console.log(
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "competition",
          name: competition.name,
          seed: competition.slug,
        })
      );
    }
    return;
  }

  for (const competition of competitions) {
    await sql.query(
      "update competitions set logo_url = $1, updated_at = now() where id = $2",
      [
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "competition",
          name: competition.name,
          seed: competition.slug,
        }),
        competition.id,
      ]
    );
  }
}

async function backfillVenues() {
  const venues = await sql.query(`
    select id, name, slug
    from venues
    where image_url is null or image_url = ''
    order by name asc
  `);

  console.log(`Venues missing images: ${venues.length}`);

  if (dryRun) {
    for (const venue of venues.slice(0, 5)) {
      console.log(
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "venue",
          name: venue.name,
          seed: venue.slug,
        })
      );
    }
    return;
  }

  for (const venue of venues) {
    await sql.query(
      "update venues set image_url = $1, updated_at = now() where id = $2",
      [
        buildFallbackEntityImageUrl({
          baseUrl: BASE_URL,
          type: "venue",
          name: venue.name,
          seed: venue.slug,
        }),
        venue.id,
      ]
    );
  }
}

async function backfillArticles() {
  const articles = await sql.query(`
    select
      a.id,
      a.title,
      a.slug,
      p.image_url as player_image_url,
      t.logo_url as team_logo_url,
      c.logo_url as competition_logo_url
    from articles a
    left join players p on p.id = a.primary_player_id
    left join teams t on t.id = a.primary_team_id
    left join competition_seasons cs on cs.id = a.competition_season_id
    left join competitions c on c.id = cs.competition_id
    where a.image_url is null or a.image_url = ''
    order by a.created_at asc
  `);

  console.log(`Articles missing images: ${articles.length}`);

  if (dryRun) {
    for (const article of articles.slice(0, 5)) {
      console.log(resolveArticleImage(article));
    }
    return;
  }

  for (const article of articles) {
    await sql.query(
      "update articles set image_url = $1, updated_at = now() where id = $2",
      [resolveArticleImage(article), article.id]
    );
  }
}

function resolveArticleImage(article: {
  title: string;
  slug: string;
  player_image_url: string | null;
  team_logo_url: string | null;
  competition_logo_url: string | null;
}) {
  return (
    article.player_image_url ||
    article.team_logo_url ||
    article.competition_logo_url ||
    buildFallbackEntityImageUrl({
      baseUrl: BASE_URL,
      type: "article",
      name: article.title,
      seed: article.slug,
    })
  );
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
