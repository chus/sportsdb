import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  decimal,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
// CORE ENTITIES
// ============================================================

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull().unique(), // '2025/26'
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const competitions = pgTable("competitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // 'Premier League'
  slug: text("slug").notNull().unique(), // 'premier-league'
  country: text("country"),
  type: text("type").notNull(), // 'league' | 'cup' | 'international'
  foundedYear: integer("founded_year"),
  logoUrl: text("logo_url"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // 'Manchester City'
    shortName: text("short_name"), // 'Man City'
    slug: text("slug").notNull().unique(), // 'manchester-city'
    country: text("country").notNull(),
    city: text("city"),
    foundedYear: integer("founded_year"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"), // hex
    secondaryColor: text("secondary_color"),
    tier: integer("tier").default(3), // 1 = top club, 2 = mid tier, 3 = other
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_teams_slug").on(table.slug)]
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // 'Erling Haaland'
    knownAs: text("known_as"), // 'Haaland'
    slug: text("slug").notNull().unique(), // 'erling-haaland'
    dateOfBirth: date("date_of_birth"),
    nationality: text("nationality"),
    secondNationality: text("second_nationality"),
    heightCm: integer("height_cm"),
    position: text("position").notNull(), // 'Forward' | 'Midfielder' | etc.
    preferredFoot: text("preferred_foot"), // 'Left' | 'Right' | 'Both'
    status: text("status").notNull().default("active"), // 'active' | 'retired'
    imageUrl: text("image_url"),
    popularityScore: integer("popularity_score").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_players_slug").on(table.slug)]
);

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // 'Etihad Stadium'
  slug: text("slug").notNull().unique(),
  city: text("city"),
  country: text("country"),
  capacity: integer("capacity"),
  openedYear: integer("opened_year"),
  imageUrl: text("image_url"),
  latitude: decimal("latitude", { precision: 9, scale: 6 }),
  longitude: decimal("longitude", { precision: 9, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// TEMPORAL RELATIONSHIPS (valid_from / valid_to)
// ============================================================

export const playerTeamHistory = pgTable(
  "player_team_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    shirtNumber: integer("shirt_number"),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"), // NULL = current
    transferType: text("transfer_type"), // 'permanent' | 'loan' | 'free' | 'youth'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_pth_player").on(table.playerId),
    index("idx_pth_team").on(table.teamId),
    index("idx_pth_current").on(table.playerId),
  ]
);

export const teamVenueHistory = pgTable("team_venue_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"), // NULL = current
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// SEASON-SCOPED RELATIONSHIPS
// ============================================================

export const competitionSeasons = pgTable(
  "competition_seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    status: text("status").notNull().default("scheduled"), // 'scheduled'|'in_progress'|'completed'
    championTeamId: uuid("champion_team_id").references(() => teams.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_competition_season").on(
      table.competitionId,
      table.seasonId
    ),
  ]
);

export const standings = pgTable(
  "standings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionSeasonId: uuid("competition_season_id")
      .notNull()
      .references(() => competitionSeasons.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    position: integer("position").notNull(),
    played: integer("played").notNull().default(0),
    won: integer("won").notNull().default(0),
    drawn: integer("drawn").notNull().default(0),
    lost: integer("lost").notNull().default(0),
    goalsFor: integer("goals_for").notNull().default(0),
    goalsAgainst: integer("goals_against").notNull().default(0),
    goalDifference: integer("goal_difference").notNull().default(0),
    points: integer("points").notNull().default(0),
    form: text("form"), // 'WWDLW'
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_standing").on(table.competitionSeasonId, table.teamId),
    index("idx_standings_cs").on(table.competitionSeasonId),
  ]
);

export const teamSeasons = pgTable(
  "team_seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    competitionSeasonId: uuid("competition_season_id")
      .notNull()
      .references(() => competitionSeasons.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_team_season").on(table.teamId, table.competitionSeasonId),
  ]
);

// ============================================================
// MATCHES
// ============================================================

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").unique(), // External API ID for deduplication (e.g., "fd-12345")
    competitionSeasonId: uuid("competition_season_id")
      .notNull()
      .references(() => competitionSeasons.id),
    homeTeamId: uuid("home_team_id")
      .notNull()
      .references(() => teams.id),
    awayTeamId: uuid("away_team_id")
      .notNull()
      .references(() => teams.id),
    venueId: uuid("venue_id").references(() => venues.id),
    matchday: integer("matchday"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"),
    // 'scheduled'|'live'|'half_time'|'finished'|'postponed'|'cancelled'
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    attendance: integer("attendance"),
    referee: text("referee"),
    minute: integer("minute"), // current minute if live
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_matches_scheduled").on(table.scheduledAt),
    index("idx_matches_status").on(table.status),
    index("idx_matches_cs").on(table.competitionSeasonId),
  ]
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    type: text("type").notNull(), // 'goal'|'yellow_card'|'red_card'|'substitution'|'penalty_missed'|'own_goal'
    minute: integer("minute").notNull(),
    addedTime: integer("added_time"),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    playerId: uuid("player_id").references(() => players.id),
    secondaryPlayerId: uuid("secondary_player_id").references(() => players.id), // assist or playerOut
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_match_events_match").on(table.matchId)]
);

export const matchLineups = pgTable(
  "match_lineups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    shirtNumber: integer("shirt_number"),
    position: text("position"),
    isStarter: boolean("is_starter").notNull().default(true),
    minutesPlayed: integer("minutes_played"),
    rating: decimal("rating", { precision: 3, scale: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_match_lineup").on(table.matchId, table.playerId),
    index("idx_match_lineups_match").on(table.matchId),
  ]
);

// ============================================================
// PLAYER SEASON STATS
// ============================================================

export const playerSeasonStats = pgTable(
  "player_season_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    competitionSeasonId: uuid("competition_season_id")
      .notNull()
      .references(() => competitionSeasons.id),
    appearances: integer("appearances").notNull().default(0),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    yellowCards: integer("yellow_cards").notNull().default(0),
    redCards: integer("red_cards").notNull().default(0),
    minutesPlayed: integer("minutes_played").notNull().default(0),
    cleanSheets: integer("clean_sheets").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_player_season_stat").on(
      table.playerId,
      table.teamId,
      table.competitionSeasonId
    ),
    index("idx_pss_player").on(table.playerId),
    index("idx_pss_cs").on(table.competitionSeasonId),
  ]
);

// ============================================================
// AUTHENTICATION
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_users_email").on(table.email)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_sessions_token").on(table.token),
    index("idx_sessions_user").on(table.userId),
  ]
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_password_reset_token").on(table.token)]
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_email_verification_token").on(table.token)]
);

// ============================================================
// FOLLOWS (User following entities)
// ============================================================

export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // 'player' | 'team' | 'competition'
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_follow").on(table.userId, table.entityType, table.entityId),
    index("idx_follows_user").on(table.userId),
    index("idx_follows_entity").on(table.entityType, table.entityId),
  ]
);

// ============================================================
// SEARCH INDEX
// ============================================================

export const searchIndex = pgTable(
  "search_index",
  {
    id: uuid("id").primaryKey(),
    entityType: text("entity_type").notNull(), // 'player'|'team'|'competition'|'venue'
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    meta: text("meta"),
    searchVector: text("search_vector"), // We'll use raw SQL for tsvector in migrations
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_search_entity_type").on(table.entityType)]
);

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'match_start' | 'goal' | 'match_end' | 'transfer'
    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: text("entity_type"), // 'player' | 'team' | 'match'
    entityId: uuid("entity_id"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_notifications_user").on(table.userId),
    index("idx_notifications_user_unread").on(table.userId, table.isRead),
  ]
);

// ============================================================
// AI CONTENT GENERATION
// ============================================================

export const matchSummaries = pgTable("match_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id)
    .unique(),

  // Generated content
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  keyMoments: text("key_moments"), // JSON array of key moments
  manOfTheMatch: uuid("motm_player_id").references(() => players.id),

  // Metadata
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  modelVersion: text("model_version"),
  promptVersion: integer("prompt_version").default(1),

  // For regeneration
  regenerateRequested: boolean("regenerate_requested").default(false),
});

export const playerMatchSummaries = pgTable(
  "player_match_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),

    // Generated content
    rating: decimal("rating", { precision: 2, scale: 1 }),
    summary: text("summary").notNull(),
    highlights: text("highlights"), // JSON array

    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_player_match_summary").on(table.matchId, table.playerId),
  ]
);

export const tournamentSummaries = pgTable(
  "tournament_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionSeasonId: uuid("competition_season_id")
      .notNull()
      .references(() => competitionSeasons.id),

    // Time period
    periodType: text("period_type").notNull(), // 'matchday' | 'week' | 'month'
    periodValue: integer("period_value"), // matchday number or week/month
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    // Generated content
    headline: text("headline").notNull(),
    summary: text("summary").notNull(),
    topPerformers: text("top_performers"), // JSON array of player IDs + reasons
    standingsMovement: text("standings_movement"), // JSON

    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_tournament_summary").on(
      table.competitionSeasonId,
      table.periodType,
      table.periodValue
    ),
  ]
);

// ============================================================
// NEWS ARTICLES
// ============================================================

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),

    // Content type: match_report, player_spotlight, round_recap, season_review, transfer_news
    type: text("type").notNull(),

    // Content
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(), // Short summary for cards/meta
    content: text("content").notNull(), // Full article markdown
    imageUrl: text("image_url"),

    // SEO
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),

    // Relationships (nullable - article may reference multiple or none)
    matchId: uuid("match_id").references(() => matches.id),
    competitionSeasonId: uuid("competition_season_id").references(
      () => competitionSeasons.id
    ),
    primaryPlayerId: uuid("primary_player_id").references(() => players.id),
    primaryTeamId: uuid("primary_team_id").references(() => teams.id),

    // For round recaps
    matchday: integer("matchday"),

    // Publishing
    status: text("status").notNull().default("draft"), // draft, published, archived
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // AI metadata
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
    modelVersion: text("model_version"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_articles_type").on(table.type),
    index("idx_articles_status").on(table.status),
    index("idx_articles_published_at").on(table.publishedAt),
    index("idx_articles_match_id").on(table.matchId),
    index("idx_articles_competition_season").on(table.competitionSeasonId),
    index("idx_articles_primary_player").on(table.primaryPlayerId),
  ]
);

// Many-to-many: articles can mention multiple players
export const articlePlayers = pgTable(
  "article_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    role: text("role"), // 'featured', 'mentioned', 'mvp'
  },
  (table) => [
    uniqueIndex("uq_article_player").on(table.articleId, table.playerId),
    index("idx_article_players_player").on(table.playerId),
  ]
);

// Many-to-many: articles can mention multiple teams
export const articleTeams = pgTable(
  "article_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    role: text("role"), // 'featured', 'mentioned'
  },
  (table) => [
    uniqueIndex("uq_article_team").on(table.articleId, table.teamId),
    index("idx_article_teams_team").on(table.teamId),
  ]
);

// ============================================================
// SEARCH ANALYTICS
// ============================================================

export const searchAnalytics = pgTable(
  "search_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: text("query").notNull(),
    resultsCount: integer("results_count").notNull(),
    entityType: text("entity_type"), // optional filter used
    searchedAt: timestamp("searched_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_search_analytics_query").on(table.query),
    index("idx_search_analytics_searched_at").on(table.searchedAt),
  ]
);
