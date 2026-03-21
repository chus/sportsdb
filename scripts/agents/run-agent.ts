/**
 * Marketing AI Agent — Master Orchestrator
 *
 * Runs all 4 agent layers in sequence:
 *   1. Analyze content gaps
 *   2. Generate content ideas
 *   3. Distribute to social
 *   4. Track performance
 *
 * Usage:
 *   npx tsx scripts/agents/run-agent.ts
 *   npx tsx scripts/agents/run-agent.ts --skip=distribute
 *   npx tsx scripts/agents/run-agent.ts --only=analyze,track
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const args = process.argv.slice(2);
const skipArg = args.find((a) => a.startsWith("--skip="));
const onlyArg = args.find((a) => a.startsWith("--only="));
const skipLayers = skipArg ? skipArg.split("=")[1].split(",") : [];
const onlyLayers = onlyArg ? onlyArg.split("=")[1].split(",") : [];

interface AgentLayer {
  name: string;
  key: string;
  script: string;
}

const layers: AgentLayer[] = [
  { name: "Analyze Content Gaps", key: "analyze", script: "analyze-gaps.ts" },
  { name: "Generate Content Ideas", key: "generate", script: "generate-content.ts" },
  { name: "Distribute to Social", key: "distribute", script: "distribute-social.ts" },
  { name: "Track Performance", key: "track", script: "track-performance.ts" },
];

function shouldRun(layer: AgentLayer): boolean {
  if (onlyLayers.length > 0) return onlyLayers.includes(layer.key);
  if (skipLayers.length > 0) return !skipLayers.includes(layer.key);
  return true;
}

async function logAction(action: string, output: string) {
  await sql`
    INSERT INTO agent_logs (agent_layer, action, output)
    VALUES ('orchestrator', ${action}, ${output})
  `;
}

async function runLayer(layer: AgentLayer): Promise<boolean> {
  const scriptPath = join(__dirname, layer.script);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Running: ${layer.name}`);
  console.log("=".repeat(50));

  try {
    execSync(`npx tsx "${scriptPath}"`, {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd(),
    });
    return true;
  } catch (error) {
    console.error(`\nLayer "${layer.name}" failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  console.log("Marketing AI Agent — Full Pipeline");
  console.log("====================================");
  console.log(`Started at: ${new Date().toISOString()}\n`);

  if (skipLayers.length > 0) console.log(`Skipping: ${skipLayers.join(", ")}`);
  if (onlyLayers.length > 0) console.log(`Only running: ${onlyLayers.join(", ")}`);

  const results: Record<string, "success" | "failed" | "skipped"> = {};

  for (const layer of layers) {
    if (!shouldRun(layer)) {
      console.log(`\nSkipping: ${layer.name}`);
      results[layer.key] = "skipped";
      continue;
    }

    const success = await runLayer(layer);
    results[layer.key] = success ? "success" : "failed";
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${"=".repeat(50)}`);
  console.log("Pipeline Complete");
  console.log("=".repeat(50));
  console.log(`Duration: ${elapsed}s\n`);

  for (const [key, status] of Object.entries(results)) {
    const icon = status === "success" ? "[OK]" : status === "failed" ? "[FAIL]" : "[SKIP]";
    console.log(`  ${icon} ${key}`);
  }

  const summary = JSON.stringify(results);
  await logAction("pipeline_complete", `${elapsed}s — ${summary}`);

  const hasFailed = Object.values(results).includes("failed");
  if (hasFailed) {
    console.log("\nSome layers failed. Check logs above for details.");
    process.exit(1);
  }

  console.log("\nAll layers completed successfully!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
