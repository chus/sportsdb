import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);
sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`.then(r => r.forEach(t => console.log(t.tablename)));
