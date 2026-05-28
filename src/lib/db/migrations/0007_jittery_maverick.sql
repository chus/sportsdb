CREATE TABLE "national_team_tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"host_country" text,
	"stage_reached" text NOT NULL,
	"finishing_position" integer,
	"played" integer,
	"won" integer,
	"drew" integer,
	"lost" integer,
	"goals_for" integer,
	"goals_against" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"region" text,
	"governing_body" text,
	"founded_year" integer,
	"edition_frequency_years" integer,
	"logo_url" text,
	"wikidata_id" text,
	"wikipedia_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tournaments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "team_type" text DEFAULT 'club' NOT NULL;--> statement-breakpoint
ALTER TABLE "national_team_tournaments" ADD CONSTRAINT "national_team_tournaments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_team_tournaments" ADD CONSTRAINT "national_team_tournaments_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ntt_team_tournament_year" ON "national_team_tournaments" USING btree ("team_id","tournament_id","year");--> statement-breakpoint
CREATE INDEX "idx_ntt_team" ON "national_team_tournaments" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_ntt_tournament_year" ON "national_team_tournaments" USING btree ("tournament_id","year");