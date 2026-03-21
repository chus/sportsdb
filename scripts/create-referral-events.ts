import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "@neondatabase/serverless";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("Creating referral_events table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_referral_events_referred ON referral_events(referred_user_id);
    CREATE INDEX IF NOT EXISTS idx_referral_events_type ON referral_events(event_type);
  `);
  console.log("✓ referral_events table created");

  // Backfill missing referral codes
  const { rows } = await pool.query(
    `SELECT id, name, email FROM users WHERE referral_code IS NULL`
  );
  console.log(`\nBackfilling ${rows.length} users with missing referral codes...`);

  for (const user of rows) {
    const prefix = (user.name || user.email.split("@")[0] || "USER")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6)
      .padEnd(3, "X");
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `REF-${prefix}-${random}`;

    await pool.query(`UPDATE users SET referral_code = $1 WHERE id = $2`, [
      code,
      user.id,
    ]);
    console.log(`  ✓ ${user.email} → ${code}`);
  }

  console.log("\nDone!");
  await pool.end();
}

main().catch(console.error);
