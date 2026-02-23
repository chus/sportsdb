/**
 * Generate AI images for teams and competitions without logos
 *
 * Usage:
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-images.ts
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-images.ts --type=teams --limit=10
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-images.ts --type=competitions
 */

import { db } from "../src/lib/db";
import { teams, competitions, players } from "../src/lib/db/schema";
import { isNull, eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI();

// Parse command line arguments
const args = process.argv.slice(2);
const typeArg = args.find(a => a.startsWith("--type="))?.split("=")[1] || "all";
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "20");
const dryRun = args.includes("--dry-run");

async function main() {
  console.log(`\n🎨 AI Image Generation Script`);
  console.log(`Type: ${typeArg}, Limit: ${limitArg}, Dry run: ${dryRun}\n`);

  if (typeArg === "teams" || typeArg === "all") {
    await generateTeamLogos(limitArg);
  }

  if (typeArg === "competitions" || typeArg === "all") {
    await generateCompetitionLogos(limitArg);
  }

  if (typeArg === "players") {
    await generatePlayerAvatars(limitArg);
  }

  console.log("\n✅ Done!");
}

async function generateTeamLogos(limit: number) {
  console.log("📋 Finding teams without logos...");

  const teamsWithoutLogos = await db
    .select()
    .from(teams)
    .where(isNull(teams.logoUrl))
    .limit(limit);

  console.log(`Found ${teamsWithoutLogos.length} teams without logos\n`);

  for (const team of teamsWithoutLogos) {
    try {
      console.log(`🏟️  Generating logo for: ${team.name} (${team.country})`);

      const prompt = buildTeamLogoPrompt(team);

      if (dryRun) {
        console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
        continue;
      }

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        console.log(`   ❌ No image generated`);
        continue;
      }

      // Update database with image URL
      await db
        .update(teams)
        .set({ logoUrl: imageUrl })
        .where(eq(teams.id, team.id));

      console.log(`   ✅ Logo generated and saved`);

      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

async function generateCompetitionLogos(limit: number) {
  console.log("🏆 Finding competitions without logos...");

  const competitionsWithoutLogos = await db
    .select()
    .from(competitions)
    .where(isNull(competitions.logoUrl))
    .limit(limit);

  console.log(`Found ${competitionsWithoutLogos.length} competitions without logos\n`);

  for (const comp of competitionsWithoutLogos) {
    try {
      console.log(`🏆 Generating logo for: ${comp.name} (${comp.country})`);

      const prompt = buildCompetitionLogoPrompt(comp);

      if (dryRun) {
        console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
        continue;
      }

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        console.log(`   ❌ No image generated`);
        continue;
      }

      // Update database with image URL
      await db
        .update(competitions)
        .set({ logoUrl: imageUrl })
        .where(eq(competitions.id, comp.id));

      console.log(`   ✅ Logo generated and saved`);

      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

function buildTeamLogoPrompt(team: typeof teams.$inferSelect): string {
  const colors = team.primaryColor && team.secondaryColor
    ? `using ${team.primaryColor} and ${team.secondaryColor} as primary colors`
    : team.primaryColor
    ? `using ${team.primaryColor} as the primary color`
    : "with bold, professional colors";

  return `Create a football club SHIELD/CREST logo for "${team.name}" from ${team.city || team.country || "Europe"}.

CRITICAL REQUIREMENTS:
- MUST be a heraldic SHIELD or CREST shape (not a photo, not a stadium, not a scene)
- Flat vector illustration style, NOT photorealistic
- Clean geometric design like FC Barcelona, Real Madrid, or Manchester United crests
- ${colors}
- Symmetric, balanced heraldic design
- May include: stripes, stars, simple iconic symbols (lion, eagle, ball)
- NO text, letters, numbers, or words
- NO photographs or realistic imagery
- NO stadiums, buildings, or landscapes
- Clean white background
- High contrast, works at small sizes (32x32 pixels)

Style: Classic European football club heraldic crest/shield emblem.`;
}

async function generatePlayerAvatars(limit: number) {
  console.log("👤 Finding players without images...");

  const playersWithoutImages = await db
    .select()
    .from(players)
    .where(isNull(players.imageUrl))
    .limit(limit);

  console.log(`Found ${playersWithoutImages.length} players without images\n`);

  for (const player of playersWithoutImages) {
    try {
      console.log(`👤 Generating avatar for: ${player.name} (${player.position})`);

      const prompt = buildPlayerAvatarPrompt(player);

      if (dryRun) {
        console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
        continue;
      }

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        console.log(`   ❌ No image generated`);
        continue;
      }

      await db
        .update(players)
        .set({ imageUrl })
        .where(eq(players.id, player.id));

      console.log(`   ✅ Avatar generated and saved`);

      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

function buildPlayerAvatarPrompt(player: typeof players.$inferSelect): string {
  const position = player.position || "Football player";
  const nationality = player.nationality || "European";

  return `Create a stylized portrait illustration of a professional ${position.toLowerCase()} football/soccer player.

STYLE REQUIREMENTS:
- Modern flat illustration style (NOT photorealistic)
- Clean vector-art aesthetic like sports trading cards or FIFA video game art
- Dynamic, confident athletic pose or headshot
- Professional football kit/jersey (generic, no specific team)
- ${nationality} appearance if recognizable features exist
- Vibrant colors, clean lines
- Slight artistic stylization (not a photograph)
- Clean solid color background (light blue or white gradient)
- Portrait/headshot composition
- Professional, heroic sports aesthetic

DO NOT include: text, logos, specific team branding, realistic photographs`;
}

function buildCompetitionLogoPrompt(comp: typeof competitions.$inferSelect): string {
  const type = comp.type === "league" ? "league" : comp.type === "cup" ? "cup/knockout" : "football";

  return `Create a professional logo for a football ${type} competition called "${comp.name}" from ${comp.country || "Europe"}.

Design requirements:
- Modern, prestigious trophy or competition emblem design
- Clean, professional vector-style artwork
- Include elements suggesting ${type === "cup/knockout" ? "a trophy or cup" : "competitive excellence and prestige"}
- Colors should feel prestigious and premium (golds, silvers, deep blues, or rich reds)
- No text, words, or letters in the design
- Clean white or transparent background
- Should look authoritative and official
- Easily recognizable at small sizes

Style: Professional sports competition branding, similar to UEFA Champions League, FIFA World Cup, or major European league logos.`;
}

main().catch(console.error);
