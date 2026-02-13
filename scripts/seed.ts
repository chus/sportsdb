/**
 * Seed script for SportsDB MVP.
 * Run: npm run db:seed
 * Requires DATABASE_URL in .env.local
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

interface PlayerSeed {
  name: string; knownAs: string; slug: string; dateOfBirth: string;
  nationality: string; heightCm: number; position: string;
  preferredFoot: string; status: "active" | "retired";
  teamSlug: string; shirtNumber: number; validFrom: string;
}

const PLAYERS: PlayerSeed[] = [
  // Man City
  { name:"Erling Haaland", knownAs:"Haaland", slug:"erling-haaland", dateOfBirth:"2000-07-21", nationality:"Norway", heightCm:195, position:"Forward", preferredFoot:"Left", status:"active", teamSlug:"manchester-city", shirtNumber:9, validFrom:"2022-07-01" },
  { name:"Kevin De Bruyne", knownAs:"De Bruyne", slug:"kevin-de-bruyne", dateOfBirth:"1991-06-28", nationality:"Belgium", heightCm:181, position:"Midfielder", preferredFoot:"Right", status:"active", teamSlug:"manchester-city", shirtNumber:17, validFrom:"2015-08-30" },
  { name:"Phil Foden", knownAs:"Foden", slug:"phil-foden", dateOfBirth:"2000-05-28", nationality:"England", heightCm:171, position:"Midfielder", preferredFoot:"Left", status:"active", teamSlug:"manchester-city", shirtNumber:47, validFrom:"2017-07-01" },
  { name:"Rodri Hernandez", knownAs:"Rodri", slug:"rodri", dateOfBirth:"1996-06-22", nationality:"Spain", heightCm:191, position:"Midfielder", preferredFoot:"Right", status:"active", teamSlug:"manchester-city", shirtNumber:16, validFrom:"2019-07-04" },
  { name:"Ederson Moraes", knownAs:"Ederson", slug:"ederson", dateOfBirth:"1993-08-17", nationality:"Brazil", heightCm:188, position:"Goalkeeper", preferredFoot:"Left", status:"active", teamSlug:"manchester-city", shirtNumber:31, validFrom:"2017-07-01" },
  // Arsenal
  { name:"Bukayo Saka", knownAs:"Saka", slug:"bukayo-saka", dateOfBirth:"2001-09-05", nationality:"England", heightCm:178, position:"Forward", preferredFoot:"Left", status:"active", teamSlug:"arsenal", shirtNumber:7, validFrom:"2019-01-01" },
  { name:"Martin Odegaard", knownAs:"Odegaard", slug:"martin-odegaard", dateOfBirth:"1998-12-17", nationality:"Norway", heightCm:178, position:"Midfielder", preferredFoot:"Left", status:"active", teamSlug:"arsenal", shirtNumber:8, validFrom:"2021-08-20" },
  { name:"William Saliba", knownAs:"Saliba", slug:"william-saliba", dateOfBirth:"2001-03-24", nationality:"France", heightCm:192, position:"Defender", preferredFoot:"Right", status:"active", teamSlug:"arsenal", shirtNumber:2, validFrom:"2022-07-01" },
  { name:"Declan Rice", knownAs:"Rice", slug:"declan-rice", dateOfBirth:"1999-01-14", nationality:"England", heightCm:188, position:"Midfielder", preferredFoot:"Right", status:"active", teamSlug:"arsenal", shirtNumber:41, validFrom:"2023-07-15" },
  // Liverpool
  { name:"Mohamed Salah", knownAs:"Salah", slug:"mohamed-salah", dateOfBirth:"1992-06-15", nationality:"Egypt", heightCm:175, position:"Forward", preferredFoot:"Left", status:"active", teamSlug:"liverpool", shirtNumber:11, validFrom:"2017-06-22" },
  { name:"Virgil van Dijk", knownAs:"Van Dijk", slug:"virgil-van-dijk", dateOfBirth:"1991-07-08", nationality:"Netherlands", heightCm:193, position:"Defender", preferredFoot:"Right", status:"active", teamSlug:"liverpool", shirtNumber:4, validFrom:"2018-01-01" },
  { name:"Trent Alexander-Arnold", knownAs:"TAA", slug:"trent-alexander-arnold", dateOfBirth:"1998-10-07", nationality:"England", heightCm:180, position:"Defender", preferredFoot:"Right", status:"active", teamSlug:"liverpool", shirtNumber:66, validFrom:"2016-10-01" },
  // Chelsea
  { name:"Cole Palmer", knownAs:"Palmer", slug:"cole-palmer", dateOfBirth:"2002-05-06", nationality:"England", heightCm:189, position:"Forward", preferredFoot:"Left", status:"active", teamSlug:"chelsea", shirtNumber:20, validFrom:"2023-09-01" },
  { name:"Enzo Fernandez", knownAs:"Enzo", slug:"enzo-fernandez", dateOfBirth:"2001-01-17", nationality:"Argentina", heightCm:178, position:"Midfielder", preferredFoot:"Right", status:"active", teamSlug:"chelsea", shirtNumber:8, validFrom:"2023-02-01" },
  // Man Utd
  { name:"Bruno Fernandes", knownAs:"Bruno", slug:"bruno-fernandes", dateOfBirth:"1994-09-08", nationality:"Portugal", heightCm:179, position:"Midfielder", preferredFoot:"Right", status:"active", teamSlug:"manchester-united", shirtNumber:8, validFrom:"2020-01-30" },
  { name:"Marcus Rashford", knownAs:"Rashford", slug:"marcus-rashford", dateOfBirth:"1997-10-31", nationality:"England", heightCm:185, position:"Forward", preferredFoot:"Right", status:"active", teamSlug:"manchester-united", shirtNumber:10, validFrom:"2015-11-01" },
  // Spurs
  { name:"Son Heung-min", knownAs:"Son", slug:"son-heung-min", dateOfBirth:"1992-07-08", nationality:"South Korea", heightCm:183, position:"Forward", preferredFoot:"Both", status:"active", teamSlug:"tottenham-hotspur", shirtNumber:7, validFrom:"2015-08-28" },
  { name:"James Maddison", knownAs:"Maddison", slug:"james-maddison", dateOfBirth:"1996-11-23", nationality:"England", heightCm:175, position:"Midfielder", preferredFoot:"Right", status:"active", teamSlug:"tottenham-hotspur", shirtNumber:10, validFrom:"2023-06-26" },
];

const STANDINGS_2526 = [
  { teamSlug:"manchester-city", position:1, played:28, won:22, drawn:4, lost:2, gf:68, ga:20, gd:48, points:70, form:"WWWDW" },
  { teamSlug:"arsenal", position:2, played:28, won:20, drawn:5, lost:3, gf:62, ga:25, gd:37, points:65, form:"WWDWW" },
  { teamSlug:"liverpool", position:3, played:28, won:19, drawn:6, lost:3, gf:58, ga:24, gd:34, points:63, form:"WDWWL" },
  { teamSlug:"chelsea", position:4, played:28, won:17, drawn:7, lost:4, gf:54, ga:28, gd:26, points:58, form:"DWWLW" },
  { teamSlug:"manchester-united", position:5, played:28, won:16, drawn:6, lost:6, gf:50, ga:32, gd:18, points:54, form:"WLWDW" },
  { teamSlug:"tottenham-hotspur", position:6, played:28, won:15, drawn:5, lost:8, gf:52, ga:38, gd:14, points:50, form:"LWWDL" },
];

async function seed() {
  console.log("🌱 Seeding database...\n");

  // Seasons
  const [s2425] = await db.insert(schema.seasons).values({ label:"2024/25", startDate:"2024-08-10", endDate:"2025-05-25", isCurrent:false }).returning();
  const [s2526] = await db.insert(schema.seasons).values({ label:"2025/26", startDate:"2025-08-09", endDate:"2026-05-24", isCurrent:true }).returning();
  console.log("✅ Seasons");

  // Competition
  const [pl] = await db.insert(schema.competitions).values({ name:"Premier League", slug:"premier-league", country:"England", type:"league", foundedYear:1992, description:"The top tier of English football" }).returning();
  console.log("✅ Competition");

  // Competition Seasons
  const [cs2425] = await db.insert(schema.competitionSeasons).values({ competitionId:pl.id, seasonId:s2425.id, status:"completed" }).returning();
  const [cs2526] = await db.insert(schema.competitionSeasons).values({ competitionId:pl.id, seasonId:s2526.id, status:"in_progress" }).returning();
  console.log("✅ Competition Seasons");

  // Venues
  const venueRows = [
    { name:"Etihad Stadium", slug:"etihad-stadium", city:"Manchester", country:"England", capacity:53400, openedYear:2003 },
    { name:"Emirates Stadium", slug:"emirates-stadium", city:"London", country:"England", capacity:60704, openedYear:2006 },
    { name:"Anfield", slug:"anfield", city:"Liverpool", country:"England", capacity:61276, openedYear:1884 },
    { name:"Stamford Bridge", slug:"stamford-bridge", city:"London", country:"England", capacity:40341, openedYear:1877 },
    { name:"Old Trafford", slug:"old-trafford", city:"Manchester", country:"England", capacity:74310, openedYear:1910 },
    { name:"Tottenham Hotspur Stadium", slug:"tottenham-hotspur-stadium", city:"London", country:"England", capacity:62850, openedYear:2019 },
  ];
  const venues = await db.insert(schema.venues).values(venueRows).returning();
  console.log("✅ Venues");

  // Teams
  const teamRows = [
    { name:"Manchester City", shortName:"Man City", slug:"manchester-city", country:"England", city:"Manchester", foundedYear:1880, primaryColor:"#6CABDD", secondaryColor:"#1C2C5B" },
    { name:"Arsenal", shortName:"Arsenal", slug:"arsenal", country:"England", city:"London", foundedYear:1886, primaryColor:"#EF0107", secondaryColor:"#063672" },
    { name:"Liverpool", shortName:"Liverpool", slug:"liverpool", country:"England", city:"Liverpool", foundedYear:1892, primaryColor:"#C8102E", secondaryColor:"#00B2A9" },
    { name:"Chelsea", shortName:"Chelsea", slug:"chelsea", country:"England", city:"London", foundedYear:1905, primaryColor:"#034694", secondaryColor:"#DBA111" },
    { name:"Manchester United", shortName:"Man Utd", slug:"manchester-united", country:"England", city:"Manchester", foundedYear:1878, primaryColor:"#DA291C", secondaryColor:"#FBE122" },
    { name:"Tottenham Hotspur", shortName:"Spurs", slug:"tottenham-hotspur", country:"England", city:"London", foundedYear:1882, primaryColor:"#132257", secondaryColor:"#FFFFFF" },
  ];
  const teamsInserted = await db.insert(schema.teams).values(teamRows).returning();
  const teamMap: Record<string, typeof teamsInserted[0]> = {};
  teamsInserted.forEach(t => teamMap[t.slug] = t);
  console.log("✅ Teams");

  // Team-Venue links
  await db.insert(schema.teamVenueHistory).values(
    teamsInserted.map((t, i) => ({ teamId: t.id, venueId: venues[i].id, validFrom: "2000-01-01" }))
  );

  // Team Seasons
  for (const t of teamsInserted) {
    await db.insert(schema.teamSeasons).values([
      { teamId: t.id, competitionSeasonId: cs2425.id },
      { teamId: t.id, competitionSeasonId: cs2526.id },
    ]);
  }
  console.log("✅ Team Seasons");

  // Players + Player-Team History
  const playerMap: Record<string, typeof insertedPlayers[0]> = {};
  const insertedPlayers: any[] = [];
  for (const p of PLAYERS) {
    const { teamSlug, shirtNumber, validFrom, ...playerFields } = p;
    const [inserted] = await db.insert(schema.players).values(playerFields).returning();
    insertedPlayers.push(inserted);
    playerMap[inserted.slug] = inserted;

    await db.insert(schema.playerTeamHistory).values({
      playerId: inserted.id,
      teamId: teamMap[teamSlug].id,
      shirtNumber,
      validFrom,
      transferType: "permanent",
    });
  }
  console.log("✅ Players + History");

  // Player Season Stats (2025/26 only for simplicity)
  const statMap: Record<string, { appearances:number; goals:number; assists:number }> = {
    "erling-haaland": { appearances:28, goals:32, assists:8 },
    "kevin-de-bruyne": { appearances:22, goals:6, assists:16 },
    "phil-foden": { appearances:26, goals:12, assists:9 },
    "bukayo-saka": { appearances:27, goals:21, assists:11 },
    "martin-odegaard": { appearances:25, goals:8, assists:14 },
    "mohamed-salah": { appearances:28, goals:24, assists:13 },
    "cole-palmer": { appearances:27, goals:18, assists:10 },
    "bruno-fernandes": { appearances:28, goals:10, assists:12 },
    "son-heung-min": { appearances:26, goals:16, assists:7 },
    "marcus-rashford": { appearances:24, goals:8, assists:5 },
  };
  for (const [slug, stats] of Object.entries(statMap)) {
    const player = playerMap[slug];
    if (!player) continue;
    const teamSlug = PLAYERS.find(p => p.slug === slug)?.teamSlug;
    if (!teamSlug) continue;
    await db.insert(schema.playerSeasonStats).values({
      playerId: player.id,
      teamId: teamMap[teamSlug].id,
      competitionSeasonId: cs2526.id,
      ...stats,
      yellowCards: Math.floor(Math.random() * 6),
      redCards: 0,
      minutesPlayed: stats.appearances * 80,
      cleanSheets: 0,
    });
  }
  console.log("✅ Player Stats");

  // Standings (2025/26)
  for (const s of STANDINGS_2526) {
    await db.insert(schema.standings).values({
      competitionSeasonId: cs2526.id,
      teamId: teamMap[s.teamSlug].id,
      position: s.position,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goalsFor: s.gf,
      goalsAgainst: s.ga,
      goalDifference: s.gd,
      points: s.points,
      form: s.form,
    });
  }
  console.log("✅ Standings");

  // Sample Matches (3 recent finished, 1 live, 1 upcoming)
  const matchRows = [
    { competitionSeasonId:cs2526.id, homeTeamId:teamMap["manchester-city"].id, awayTeamId:teamMap["liverpool"].id, venueId:venues[0].id, matchday:28, scheduledAt:"2026-02-08T16:30:00Z", status:"finished", homeScore:2, awayScore:1, attendance:53284, referee:"Michael Oliver" },
    { competitionSeasonId:cs2526.id, homeTeamId:teamMap["arsenal"].id, awayTeamId:teamMap["chelsea"].id, venueId:venues[1].id, matchday:28, scheduledAt:"2026-02-08T14:00:00Z", status:"finished", homeScore:3, awayScore:1, attendance:60542, referee:"Anthony Taylor" },
    { competitionSeasonId:cs2526.id, homeTeamId:teamMap["manchester-united"].id, awayTeamId:teamMap["tottenham-hotspur"].id, venueId:venues[4].id, matchday:28, scheduledAt:"2026-02-07T20:00:00Z", status:"finished", homeScore:1, awayScore:1, attendance:73864, referee:"Craig Pawson" },
    { competitionSeasonId:cs2526.id, homeTeamId:teamMap["liverpool"].id, awayTeamId:teamMap["arsenal"].id, venueId:venues[2].id, matchday:29, scheduledAt:"2026-02-15T16:30:00Z", status:"scheduled", homeScore:null, awayScore:null, attendance:null, referee:null },
    { competitionSeasonId:cs2526.id, homeTeamId:teamMap["chelsea"].id, awayTeamId:teamMap["manchester-city"].id, venueId:venues[3].id, matchday:29, scheduledAt:"2026-02-15T14:00:00Z", status:"scheduled", homeScore:null, awayScore:null, attendance:null, referee:null },
  ];
  const matchesInserted = await db.insert(schema.matches).values(matchRows).returning();
  console.log("✅ Matches");

  // Match events for Man City vs Liverpool
  const mcLivMatch = matchesInserted[0];
  await db.insert(schema.matchEvents).values([
    { matchId:mcLivMatch.id, type:"goal", minute:12, teamId:teamMap["manchester-city"].id, playerId:playerMap["erling-haaland"].id, secondaryPlayerId:playerMap["kevin-de-bruyne"].id, description:"Haaland heads in from De Bruyne cross" },
    { matchId:mcLivMatch.id, type:"goal", minute:34, teamId:teamMap["liverpool"].id, playerId:playerMap["mohamed-salah"].id, secondaryPlayerId:playerMap["trent-alexander-arnold"].id, description:"Salah finishes from TAA through ball" },
    { matchId:mcLivMatch.id, type:"goal", minute:67, teamId:teamMap["manchester-city"].id, playerId:playerMap["phil-foden"].id, description:"Foden strikes from edge of box" },
    { matchId:mcLivMatch.id, type:"yellow_card", minute:72, teamId:teamMap["manchester-city"].id, playerId:playerMap["rodri"].id },
  ]);
  console.log("✅ Match Events");

  // Search index
  const searchRows = [
    ...insertedPlayers.map(p => ({
      id: p.id,
      entityType: "player" as const,
      slug: p.slug,
      name: p.name,
      subtitle: PLAYERS.find(pp => pp.slug === p.slug)?.teamSlug?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? null,
      meta: p.position,
    })),
    ...teamsInserted.map(t => ({
      id: t.id,
      entityType: "team" as const,
      slug: t.slug,
      name: t.name,
      subtitle: "Premier League",
      meta: t.country,
    })),
    {
      id: pl.id,
      entityType: "competition" as const,
      slug: pl.slug,
      name: pl.name,
      subtitle: pl.country,
      meta: pl.type,
    },
    ...venues.map(v => ({
      id: v.id,
      entityType: "venue" as const,
      slug: v.slug,
      name: v.name,
      subtitle: v.city,
      meta: v.country,
    })),
  ];
  await db.insert(schema.searchIndex).values(searchRows);
  console.log("✅ Search Index");

  console.log("\n🎉 Seed complete!");
  console.log(`   ${insertedPlayers.length} players`);
  console.log(`   ${teamsInserted.length} teams`);
  console.log(`   ${matchesInserted.length} matches`);
  console.log(`   ${STANDINGS_2526.length} standings rows`);
  console.log(`   ${searchRows.length} search index entries`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
