/**
 * Small CLI for article generation cron controls.
 *
 * Usage:
 *   npx tsx scripts/manage-article-generation.ts status
 *   npx tsx scripts/manage-article-generation.ts status --base-url=http://localhost:3000
 *   npx tsx scripts/manage-article-generation.ts run --dryRun=true
 *   npx tsx scripts/manage-article-generation.ts run --matchReportsLimit=20 --playerSpotlightsLimit=10
 *
 * Auth:
 *   Set CRON_SECRET to send Authorization: Bearer <secret>.
 *   Optionally override with --cron-secret=<secret>.
 */

type Command = "status" | "run";

type GenerationConfig = {
  matchReportsLimit?: number;
  roundRecapsLimit?: number;
  playerSpotlightsLimit?: number;
  recapMinFinishedMatches?: number;
  spotlightLookbackDays?: number;
  spotlightMinGoals?: number;
  dryRun?: boolean;
};

const CONFIG_KEYS: Array<keyof GenerationConfig> = [
  "matchReportsLimit",
  "roundRecapsLimit",
  "playerSpotlightsLimit",
  "recapMinFinishedMatches",
  "spotlightLookbackDays",
  "spotlightMinGoals",
  "dryRun",
];

function parseCliArgs(rawArgs: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const keyValue = arg.slice(2);
    const [key, inlineValue] = keyValue.split("=", 2);
    if (!key) continue;

    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }

    const next = rawArgs[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = "true";
    }
  }

  return { positional, flags };
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildGenerationConfig(flags: Record<string, string>): GenerationConfig {
  const config: GenerationConfig = {};

  for (const key of CONFIG_KEYS) {
    const raw = flags[key];
    if (raw === undefined) continue;

    if (key === "dryRun") {
      const value = parseBoolean(raw);
      if (value !== undefined) config.dryRun = value;
      continue;
    }

    const value = parsePositiveInt(raw);
    if (value !== undefined) {
      config[key] = value;
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
manage-article-generation

Commands:
  status                  Get generation health + pending counts
  run                     Trigger manual generation via POST

Options:
  --base-url=<url>        Default: SPORTSDB_BASE_URL or http://localhost:3000
  --cron-secret=<secret>  Default: CRON_SECRET env var
  --dryRun=<bool>         true/false (for run, or status pending calc)
  --matchReportsLimit=<n>
  --roundRecapsLimit=<n>
  --playerSpotlightsLimit=<n>
  --recapMinFinishedMatches=<n>
  --spotlightLookbackDays=<n>
  --spotlightMinGoals=<n>
`);
}

async function main() {
  const { positional, flags } = parseCliArgs(process.argv.slice(2));
  const command = positional[0] as Command | undefined;

  if (flags.help === "true") {
    printHelp();
    process.exit(0);
  }

  if (!command || command === ("help" as Command)) {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  if (command !== "status" && command !== "run") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  const baseUrl =
    flags["base-url"] || process.env.SPORTSDB_BASE_URL || "http://localhost:3000";
  const cronSecret = flags["cron-secret"] || process.env.CRON_SECRET;

  const headers: Record<string, string> = {};
  if (cronSecret) {
    headers.authorization = `Bearer ${cronSecret}`;
  }

  const config = buildGenerationConfig(flags);
  const endpoint = new URL("/api/cron/generate-articles", baseUrl);

  if (command === "status") {
    endpoint.searchParams.set("mode", "status");
    for (const [key, value] of Object.entries(config)) {
      endpoint.searchParams.set(key, String(value));
    }

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`Status request failed (${response.status}):`, data);
      process.exit(1);
    }

    console.log(JSON.stringify(data, null, 2));
    return;
  }

  headers["content-type"] = "application/json";
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(config),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`Run request failed (${response.status}):`, data);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
