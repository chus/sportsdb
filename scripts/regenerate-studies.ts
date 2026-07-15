/**
 * Regenerate all data studies from current season stats, outside the weekly
 * cron cadence — e.g. after a data repair (duplicate-player merge) leaves the
 * stored rankings stale. Mirrors /api/cron/generate-study minus the operator
 * email and pitch draft (existing pitch drafts are kept).
 *
 * Usage: npx tsx scripts/regenerate-studies.ts [--no-narrative]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Import after dotenv so @/lib/db sees DATABASE_URL.
  const { generateAllStudies, generateCompetitionStudies } = await import("../src/lib/studies/generators");
  const { draftNarrative } = await import("../src/lib/studies/narrative");
  const { upsertStudy } = await import("../src/lib/queries/studies");

  const withNarrative = !process.argv.includes("--no-narrative");
  const generatedAt = new Date().toISOString();

  const global = await generateAllStudies(generatedAt);
  const wc = await generateCompetitionStudies(generatedAt, "fifa-world-cup-2026", "the 2026 World Cup", "world-cup-2026");
  const all = [...global, ...wc];

  for (const study of all) {
    if (withNarrative) {
      study.data.narrative = (await draftNarrative(study)) ?? undefined;
    }
    await upsertStudy(study, null);
    console.log(`  ${study.slug}: ${study.data.rows.length} rows`);
  }
  console.log(`\nRegenerated ${all.length} studies.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
