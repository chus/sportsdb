ALTER TABLE "competitions" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_external_id_unique" UNIQUE("external_id");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_external_id_unique" UNIQUE("external_id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_external_id_unique" UNIQUE("external_id");