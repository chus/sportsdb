CREATE TABLE "search_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"results_count" integer NOT NULL,
	"entity_type" text,
	"searched_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_search_analytics_query" ON "search_analytics" USING btree ("query");--> statement-breakpoint
CREATE INDEX "idx_search_analytics_searched_at" ON "search_analytics" USING btree ("searched_at");