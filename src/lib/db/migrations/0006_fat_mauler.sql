CREATE TABLE "challenge_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_index" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "challenge_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"category" text NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"active_date" date,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pickem_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"points" integer,
	"is_correct" boolean,
	"submitted_at" timestamp with time zone DEFAULT now(),
	"scored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sports_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"importance" integer DEFAULT 1 NOT NULL,
	"competition_id" uuid,
	"match_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "idx_sports_events_unique" UNIQUE NULLS NOT DISTINCT("date","type","competition_id")
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"from_team_id" uuid,
	"to_team_id" uuid NOT NULL,
	"transfer_date" date NOT NULL,
	"transfer_fee_eur" integer,
	"market_value_at_transfer" integer,
	"season" text,
	"transfermarkt_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfers_transfermarkt_id_unique" UNIQUE("transfermarkt_id")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "sports_event_id" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "word_count" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "is_indexable" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "enriched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "transfermarkt_id" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "market_value_eur" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "highest_market_value_eur" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "contract_expiration_date" date;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "wikidata_id" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "place_of_birth" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "wikipedia_url" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "instagram_handle" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "twitter_handle" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "article_id" uuid;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "transfermarkt_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "coach_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "squad_market_value" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "wikidata_id" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "wikipedia_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "instagram_handle" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "twitter_handle" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "wikidata_id" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "wikipedia_url" text;--> statement-breakpoint
ALTER TABLE "challenge_answers" ADD CONSTRAINT "challenge_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_answers" ADD CONSTRAINT "challenge_answers_question_id_challenge_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."challenge_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_predictions" ADD CONSTRAINT "pickem_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_predictions" ADD CONSTRAINT "pickem_predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_events" ADD CONSTRAINT "sports_events_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_team_id_teams_id_fk" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_team_id_teams_id_fk" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_challenge_answer" ON "challenge_answers" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_answer_user" ON "challenge_answers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_q_date" ON "challenge_questions" USING btree ("active_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pickem" ON "pickem_predictions" USING btree ("user_id","match_id");--> statement-breakpoint
CREATE INDEX "idx_pickem_user" ON "pickem_predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pickem_match" ON "pickem_predictions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_sports_events_date" ON "sports_events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_sports_events_type" ON "sports_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_sports_events_importance" ON "sports_events" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "idx_transfers_player" ON "transfers" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_from" ON "transfers" USING btree ("from_team_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_to" ON "transfers" USING btree ("to_team_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_date" ON "transfers" USING btree ("transfer_date");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_sports_event_id_sports_events_id_fk" FOREIGN KEY ("sports_event_id") REFERENCES "public"."sports_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_articles_sports_event" ON "articles" USING btree ("sports_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_matches_slug" ON "matches" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_players_transfermarkt" ON "players" USING btree ("transfermarkt_id");--> statement-breakpoint
CREATE INDEX "idx_social_posts_article" ON "social_posts" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_social_posts_status" ON "social_posts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_teams_transfermarkt" ON "teams" USING btree ("transfermarkt_id");