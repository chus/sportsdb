/**
 * Clean up player names with bracket references like "Nicolas Jover[234]"
 */

import { db } from "../src/lib/db";
import { players, playerTeamHistory, playerSeasonStats } from "../src/lib/db/schema";
import { like, eq } from "drizzle-orm";

async function main() {
  // Find players with brackets in their names
  const badPlayers = await db
    .select({ id: players.id, name: players.name, slug: players.slug })
    .from(players)
    .where(like(players.name, "%[%"));

  console.log("Processing", badPlayers.length, "players with brackets in names...\n");

  let deleted = 0;
  let cleaned = 0;

  for (const player of badPlayers) {
    const name = player.name;

    // If name is just brackets (no real name), delete
    if (/^\s*\[\d+\]\s*$/.test(name) || /^\s*\[note \d+\]\s*$/.test(name)) {
      await db.delete(playerTeamHistory).where(eq(playerTeamHistory.playerId, player.id));
      await db.delete(playerSeasonStats).where(eq(playerSeasonStats.playerId, player.id));
      await db.delete(players).where(eq(players.id, player.id));
      console.log("Deleted (empty):", name);
      deleted++;
      continue;
    }

    // If name contains multiple people (has bracket followed by capital letter), delete
    if (/\[\d+\]\s+[A-Z]/.test(name)) {
      await db.delete(playerTeamHistory).where(eq(playerTeamHistory.playerId, player.id));
      await db.delete(playerSeasonStats).where(eq(playerSeasonStats.playerId, player.id));
      await db.delete(players).where(eq(players.id, player.id));
      console.log("Deleted (concatenated):", name);
      deleted++;
      continue;
    }

    // Clean the name by removing bracket content
    let cleanName = name
      .replace(/\s*\[\d+\]\s*/g, "") // Remove [123]
      .replace(/\s*\[note \d+\]\s*/g, "") // Remove [note 1]
      .replace(/\s*\[[a-z]{2}\]\s*/g, "") // Remove [es], [fr]
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();

    if (cleanName && cleanName !== name) {
      // Generate new slug
      const newSlug = cleanName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Check if slug already exists
      const existing = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.slug, newSlug))
        .limit(1);

      if (existing.length > 0) {
        // Duplicate - delete this bad entry
        await db.delete(playerTeamHistory).where(eq(playerTeamHistory.playerId, player.id));
        await db.delete(playerSeasonStats).where(eq(playerSeasonStats.playerId, player.id));
        await db.delete(players).where(eq(players.id, player.id));
        console.log("Deleted (duplicate):", name);
        deleted++;
      } else {
        await db
          .update(players)
          .set({ name: cleanName, slug: newSlug })
          .where(eq(players.id, player.id));
        console.log("Cleaned:", name, "->", cleanName);
        cleaned++;
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log("Deleted:", deleted);
  console.log("Cleaned:", cleaned);
}

main().catch(console.error);
