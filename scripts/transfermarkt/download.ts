/**
 * Download Transfermarkt dataset CSVs from Cloudflare R2
 *
 * Downloads:
 * - players.csv.gz (37K+ players)
 * - clubs.csv.gz (400+ clubs)
 * - transfers.csv.gz (87K+ transfers)
 *
 * Usage:
 *   npx tsx scripts/transfermarkt/download.ts
 */

import { createWriteStream, existsSync } from "fs";
import { mkdir } from "fs/promises";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { Readable } from "stream";

const BASE_URL =
  "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data";

const FILES = ["players.csv", "clubs.csv", "transfers.csv"];

const OUT_DIR = "data/transfermarkt";

async function downloadFile(name: string): Promise<void> {
  const outPath = `${OUT_DIR}/${name}`;

  if (existsSync(outPath)) {
    console.log(`  ${name} — already exists, skipping`);
    return;
  }

  const url = `${BASE_URL}/${name}.gz`;
  console.log(`  Downloading ${name}.gz ...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  const body = res.body;
  if (!body) throw new Error("No response body");

  const nodeStream = Readable.fromWeb(body as any);
  const gunzip = createGunzip();
  const fileStream = createWriteStream(outPath);

  await pipeline(nodeStream, gunzip, fileStream);

  console.log(`  ${name} — done`);
}

async function main() {
  console.log("\nTransfermarkt Dataset Download\n");

  await mkdir(OUT_DIR, { recursive: true });

  for (const file of FILES) {
    await downloadFile(file);
  }

  console.log("\nAll files downloaded to data/transfermarkt/\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
