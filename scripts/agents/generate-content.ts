/**
 * Marketing AI Agent — Layer 2: Generate Content
 *
 * Reads content-gaps.json and generates article ideas (title + outline)
 * using Claude API. Saves to data/generated-content/ for human review.
 * Does NOT auto-publish.
 *
 * Usage:
 *   npx tsx scripts/agents/generate-content.ts
 *   npx tsx scripts/agents/generate-content.ts --limit=3
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const MAX_ARTICLES = limitArg ? parseInt(limitArg.split("=")[1], 10) : 5;

interface ContentGap {
  entityType: string;
  entityId: string;
  entityName: string;
  entitySlug: string;
  reason: string;
  articleCount: number;
}

interface GeneratedIdea {
  gapEntityType: string;
  gapEntityName: string;
  gapEntitySlug: string;
  articleType: string;
  title: string;
  outline: string[];
  suggestedSlug: string;
  generatedAt: string;
}

function buildPrompt(gap: ContentGap): string {
  const typeMap: Record<string, string> = {
    team: "A deep-dive article about the team's history, current season, and key players.",
    player: "A player spotlight article covering recent form, career trajectory, and playing style.",
    competition: "A competition overview or season preview covering format, key storylines, and teams to watch.",
  };

  return `You are a sports content strategist for a football (soccer) database website focused on SEO.

Generate a single article idea for the following entity that currently has thin content coverage:

Entity type: ${gap.entityType}
Entity name: ${gap.entityName}
Content gap: ${gap.reason}
Desired tone: ${typeMap[gap.entityType] || "Informative sports article."}

Return a JSON object with these fields:
- "articleType": one of "player_spotlight", "match_report", "round_recap", "season_review"
- "title": compelling SEO-friendly title (60-70 characters)
- "outline": array of 5-7 section headings for the article
- "suggestedSlug": URL-friendly slug for the article

Return ONLY valid JSON, no markdown fences.`;
}

async function generateIdea(gap: ContentGap): Promise<GeneratedIdea | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(gap) }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      gapEntityType: gap.entityType,
      gapEntityName: gap.entityName,
      gapEntitySlug: gap.entitySlug,
      articleType: parsed.articleType,
      title: parsed.title,
      outline: parsed.outline,
      suggestedSlug: parsed.suggestedSlug,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`  Claude API error for ${gap.entityName}:`, error);
    return null;
  }
}

async function logAction(action: string, input: string, output: string) {
  await sql`
    INSERT INTO agent_logs (agent_layer, action, input, output)
    VALUES ('generate', ${action}, ${input}, ${output})
  `;
}

async function main() {
  console.log("Agent Layer 2: Generate Content Ideas");
  console.log("======================================\n");

  const gapsPath = join(process.cwd(), "data", "content-gaps.json");
  if (!existsSync(gapsPath)) {
    console.error("No content-gaps.json found. Run analyze-gaps.ts first.");
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(gapsPath, "utf-8"));
  const gaps: ContentGap[] = report.gaps.slice(0, MAX_ARTICLES);
  console.log(`Processing ${gaps.length} gaps (max ${MAX_ARTICLES})\n`);

  const outDir = join(process.cwd(), "data", "generated-content");
  mkdirSync(outDir, { recursive: true });

  let generated = 0;

  for (const gap of gaps) {
    console.log(`Generating idea for: ${gap.entityName} (${gap.entityType})`);
    const idea = await generateIdea(gap);

    if (idea) {
      const filename = `${idea.suggestedSlug || gap.entitySlug}-${Date.now()}.json`;
      writeFileSync(join(outDir, filename), JSON.stringify(idea, null, 2));
      console.log(`  Saved: ${filename} — "${idea.title}"`);
      await logAction("generate_idea", gap.entityName, idea.title);
      generated++;
    } else {
      console.log("  Skipped — generation failed");
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nGenerated ${generated}/${gaps.length} article ideas`);
  await logAction("generate_run_complete", `${gaps.length} gaps`, `${generated} ideas`);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
