# SportsDB — Architecture, Schema & Implementation Plan

---

## 1. Tech Stack Recommendation

### Decision Rationale

The Figma export is a Vite + React SPA with Tailwind v4, Radix UI, and lucide-react. Rather than throw that away, we'll evolve it into an SSR-capable app while reusing the existing component library.

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | **Next.js 15 (App Router)** | SSR/SSG for SEO, file-based routing matches the URL structure, React Server Components for data-heavy pages. Incremental adoption — existing React components port directly. |
| **Styling** | **Tailwind CSS v4** | Already in place from Figma export. Zero migration cost. |
| **Component lib** | **Radix UI + existing components** | Already built. Accessible primitives for toggles, dropdowns, dialogs. |
| **Database** | **PostgreSQL 16** | Best support for temporal queries, partial indexes, full-text search via `tsvector`. Time-aware modeling is first-class. |
| **ORM** | **Drizzle ORM** | Type-safe, thin abstraction, excellent Postgres support, clean migration workflow. Lighter than Prisma for complex queries. |
| **API layer** | **Next.js Route Handlers + Server Actions** | Co-located with pages. No separate API server for MVP. tRPC is overkill at this stage. |
| **Search** | **Postgres full-text search** (MVP) | Good enough for entity search across ~100K records. Upgrade path to Meilisearch/Typesense later. |
| **Hosting** | **Vercel** (app) + **Neon** or **Supabase** (Postgres) | Zero-config deploys, edge functions, ISR for static entity pages. Neon's serverless Postgres fits the serverless model. |
| **Validation** | **Zod** | Shared schemas between API and client. Already common in Next.js ecosystem. |
| **Date handling** | **date-fns** | Already in the Figma export dependencies. |

### What we're NOT using (and why)

- **Prisma**: Overhead for the complex temporal joins we need. Drizzle gives us raw SQL escape hatches.
- **Separate Express/Fastify backend**: Unnecessary for MVP. Next.js route handlers cover API needs. If we need a dedicated API later (mobile app, third-party consumers), we extract.
- **Redis**: Not needed at MVP scale. Postgres + ISR handles caching.
- **GraphQL**: Over-engineered for a read-heavy database with known page shapes.

---

## 2. Database Schema

### Time-Awareness Strategy

Two patterns, used where appropriate:

| Pattern | Used for | Fields |
|---------|----------|--------|
| **Season-scoped** | Stats, standings, squad membership, competition participation | `season_id` FK |
| **Temporal range** | Player-team history, coaching stints, venue assignments | `valid_from DATE`, `valid_to DATE NULL` (NULL = current) |

This is intentional. Season-scoped data aligns with how football actually works (transfers happen between seasons, stats reset). Temporal ranges handle mid-season changes (January transfers, sackings).

### Entity Relationship Diagram (text)

```
Competition ──< CompetitionSeason >── Season
                      │
                      ├──< Standing (per team per season)
                      └──< Match
                              │
                              ├──< MatchEvent (goals, cards, subs)
                              └──< MatchLineup (player appearances)

Team ──< PlayerTeamHistory >── Player
  │                              │
  │                              └──< PlayerSeasonStat
  └──< TeamSeason (per competition per season)

Venue ──< Match (via venue_id)
Venue ──< TeamVenueHistory (temporal)
```

### Table Definitions

```sql
-- ============================================================
-- CORE ENTITIES
-- ============================================================

CREATE TABLE seasons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT NOT NULL UNIQUE,       -- '2025/26'
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_current    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE competitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,               -- 'Premier League'
  slug          TEXT NOT NULL UNIQUE,         -- 'premier-league'
  country       TEXT,                         -- 'England'
  type          TEXT NOT NULL,                -- 'league' | 'cup' | 'international'
  founded_year  INT,
  logo_url      TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,               -- 'Manchester City'
  short_name    TEXT,                        -- 'Man City'
  slug          TEXT NOT NULL UNIQUE,         -- 'manchester-city'
  country       TEXT NOT NULL,
  city          TEXT,
  founded_year  INT,
  logo_url      TEXT,
  primary_color TEXT,                        -- hex
  secondary_color TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,               -- 'Erling Haaland'
  known_as      TEXT,                        -- 'Haaland'
  slug          TEXT NOT NULL UNIQUE,         -- 'erling-haaland'
  date_of_birth DATE,
  nationality   TEXT,
  second_nationality TEXT,
  height_cm     INT,
  position      TEXT NOT NULL,               -- 'Forward' | 'Midfielder' | ...
  preferred_foot TEXT,                       -- 'Left' | 'Right' | 'Both'
  status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'retired' | 'deceased'
  image_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE venues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,               -- 'Etihad Stadium'
  slug          TEXT NOT NULL UNIQUE,
  city          TEXT,
  country       TEXT,
  capacity      INT,
  opened_year   INT,
  image_url     TEXT,
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEMPORAL RELATIONSHIPS (valid_from / valid_to)
-- ============================================================

CREATE TABLE player_team_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id),
  team_id       UUID NOT NULL REFERENCES teams(id),
  shirt_number  INT,
  valid_from    DATE NOT NULL,
  valid_to      DATE,                        -- NULL = current
  transfer_type TEXT,                        -- 'permanent' | 'loan' | 'free' | 'youth'
  created_at    TIMESTAMPTZ DEFAULT now(),

  -- Enforce no overlapping stints at the same team
  CONSTRAINT no_overlap EXCLUDE USING gist (
    player_id WITH =,
    daterange(valid_from, valid_to, '[)') WITH &&
  )
);

CREATE TABLE team_venue_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id),
  venue_id      UUID NOT NULL REFERENCES venues(id),
  valid_from    DATE NOT NULL,
  valid_to      DATE,                        -- NULL = current
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEASON-SCOPED RELATIONSHIPS
-- ============================================================

CREATE TABLE competition_seasons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL REFERENCES competitions(id),
  season_id       UUID NOT NULL REFERENCES seasons(id),
  status          TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled'|'in_progress'|'completed'
  champion_team_id UUID REFERENCES teams(id),
  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(competition_id, season_id)
);

CREATE TABLE standings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  team_id             UUID NOT NULL REFERENCES teams(id),
  position            INT NOT NULL,
  played              INT NOT NULL DEFAULT 0,
  won                 INT NOT NULL DEFAULT 0,
  drawn               INT NOT NULL DEFAULT 0,
  lost                INT NOT NULL DEFAULT 0,
  goals_for           INT NOT NULL DEFAULT 0,
  goals_against       INT NOT NULL DEFAULT 0,
  goal_difference     INT NOT NULL DEFAULT 0,
  points              INT NOT NULL DEFAULT 0,
  form                TEXT,                  -- 'WWDLW' last 5
  updated_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE(competition_season_id, team_id)
);

CREATE TABLE team_seasons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID NOT NULL REFERENCES teams(id),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  created_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE(team_id, competition_season_id)
);

-- ============================================================
-- MATCHES
-- ============================================================

CREATE TABLE matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  home_team_id        UUID NOT NULL REFERENCES teams(id),
  away_team_id        UUID NOT NULL REFERENCES teams(id),
  venue_id            UUID REFERENCES venues(id),
  matchday            INT,                   -- round/gameweek number
  scheduled_at        TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'scheduled',
                      -- 'scheduled'|'live'|'half_time'|'finished'|'postponed'|'cancelled'
  home_score          INT,
  away_score          INT,
  attendance          INT,
  referee             TEXT,
  minute              INT,                   -- current minute if live
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE match_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES matches(id),
  type          TEXT NOT NULL,               -- 'goal'|'yellow_card'|'red_card'|'substitution'|'penalty_missed'|'own_goal'
  minute        INT NOT NULL,
  added_time    INT,                         -- e.g. 45+2
  team_id       UUID NOT NULL REFERENCES teams(id),
  player_id     UUID REFERENCES players(id),
  secondary_player_id UUID REFERENCES players(id), -- assist or player_out for subs
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE match_lineups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES matches(id),
  team_id       UUID NOT NULL REFERENCES teams(id),
  player_id     UUID NOT NULL REFERENCES players(id),
  shirt_number  INT,
  position      TEXT,                        -- 'GK','CB','RB','LB','CM','CAM','RW','LW','ST'
  is_starter    BOOLEAN NOT NULL DEFAULT true,
  minutes_played INT,
  rating        DECIMAL(3,1),
  created_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(match_id, player_id)
);

-- ============================================================
-- PLAYER SEASON STATS (aggregated per season per competition)
-- ============================================================

CREATE TABLE player_season_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           UUID NOT NULL REFERENCES players(id),
  team_id             UUID NOT NULL REFERENCES teams(id),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  appearances         INT NOT NULL DEFAULT 0,
  goals               INT NOT NULL DEFAULT 0,
  assists             INT NOT NULL DEFAULT 0,
  yellow_cards        INT NOT NULL DEFAULT 0,
  red_cards           INT NOT NULL DEFAULT 0,
  minutes_played      INT NOT NULL DEFAULT 0,
  clean_sheets        INT NOT NULL DEFAULT 0, -- for GKs
  updated_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE(player_id, team_id, competition_season_id)
);

-- ============================================================
-- SEARCH SUPPORT
-- ============================================================

-- Materialized view or table for unified search
CREATE TABLE search_index (
  id            UUID PRIMARY KEY,
  entity_type   TEXT NOT NULL,               -- 'player'|'team'|'competition'|'venue'
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  subtitle      TEXT,                        -- e.g. team name for player, country for team
  meta          TEXT,                        -- position, league, etc.
  search_vector TSVECTOR,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_search_vector ON search_index USING gin(search_vector);
CREATE INDEX idx_search_entity_type ON search_index(entity_type);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_player_team_history_player ON player_team_history(player_id);
CREATE INDEX idx_player_team_history_team ON player_team_history(team_id);
CREATE INDEX idx_player_team_history_current ON player_team_history(player_id) WHERE valid_to IS NULL;
CREATE INDEX idx_matches_scheduled ON matches(scheduled_at);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_competition_season ON matches(competition_season_id);
CREATE INDEX idx_standings_competition ON standings(competition_season_id);
CREATE INDEX idx_player_stats_player ON player_season_stats(player_id);
CREATE INDEX idx_player_stats_competition ON player_season_stats(competition_season_id);
CREATE INDEX idx_match_events_match ON match_events(match_id);
CREATE INDEX idx_match_lineups_match ON match_lineups(match_id);
CREATE INDEX idx_players_slug ON players(slug);
CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_competitions_slug ON competitions(slug);
```

### Key Query Patterns

**"Current team for player" (Now mode):**
```sql
SELECT t.* FROM teams t
JOIN player_team_history pth ON pth.team_id = t.id
WHERE pth.player_id = $1 AND pth.valid_to IS NULL;
```

**"Player stats for season X":**
```sql
SELECT pss.* FROM player_season_stats pss
JOIN competition_seasons cs ON cs.id = pss.competition_season_id
WHERE pss.player_id = $1 AND cs.season_id = $2;
```

**"Team squad as of season X":**
```sql
SELECT p.*, pth.shirt_number FROM players p
JOIN player_team_history pth ON pth.player_id = p.id
JOIN seasons s ON s.id = $2
WHERE pth.team_id = $1
  AND pth.valid_from <= s.end_date
  AND (pth.valid_to IS NULL OR pth.valid_to >= s.start_date);
```

**"Live matches":**
```sql
SELECT * FROM matches WHERE status IN ('live', 'half_time') ORDER BY scheduled_at;
```

---

## 3. Project Folder Structure

```
sportsdb/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (nav, footer)
│   │   ├── page.tsx                  # Home page (SSR)
│   │   ├── players/
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # /players/erling-haaland
│   │   ├── teams/
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # /teams/manchester-city
│   │   ├── competitions/
│   │   │   ├── [slug]/
│   │   │   │   ├── page.tsx          # /competitions/premier-league (current season)
│   │   │   │   └── [season]/
│   │   │   │       └── page.tsx      # /competitions/premier-league/2024-25
│   │   ├── matches/
│   │   │   └── [id]/
│   │   │       └── page.tsx          # /matches/<uuid>
│   │   ├── search/
│   │   │   └── page.tsx              # /search?q=haaland
│   │   └── api/                      # Route handlers
│   │       ├── search/
│   │       │   └── route.ts          # GET /api/search?q=...&type=...
│   │       ├── matches/
│   │       │   └── live/
│   │       │       └── route.ts      # GET /api/matches/live
│   │       └── players/
│   │           └── [id]/
│   │               └── stats/
│   │                   └── route.ts  # GET /api/players/:id/stats?season=...
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Radix primitives (from Figma export)
│   │   │   ├── button.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   ├── layout/                   # App shell
│   │   │   ├── navbar.tsx
│   │   │   ├── footer.tsx
│   │   │   └── sidebar-layout.tsx    # 2/3 + 1/3 reusable layout
│   │   ├── entity/                   # Reusable entity components
│   │   │   ├── entity-hero.tsx       # Shared hero pattern (player, team, competition)
│   │   │   ├── stat-grid.tsx         # Stat display (appearances, goals, etc.)
│   │   │   ├── timeline-card.tsx     # Career timeline item
│   │   │   ├── standings-table.tsx
│   │   │   ├── match-card.tsx        # Used in lists and horizontal scrolls
│   │   │   ├── player-card.tsx
│   │   │   ├── team-card.tsx
│   │   │   └── moment-card.tsx
│   │   ├── search/
│   │   │   ├── search-bar.tsx
│   │   │   └── search-results.tsx
│   │   ├── time/
│   │   │   └── time-toggle.tsx       # Now / Season switcher
│   │   └── live/
│   │       └── live-match-card.tsx
│   │
│   ├── lib/                          # Business logic & data access
│   │   ├── db/
│   │   │   ├── index.ts              # Drizzle client + connection
│   │   │   ├── schema.ts             # Drizzle schema definitions
│   │   │   └── migrations/           # SQL migration files
│   │   ├── queries/                   # Named query functions
│   │   │   ├── players.ts            # getPlayer, getPlayerStats, getPlayerCareer
│   │   │   ├── teams.ts              # getTeam, getSquad, getTeamStats
│   │   │   ├── competitions.ts       # getCompetition, getStandings, getTopScorers
│   │   │   ├── matches.ts            # getMatch, getLiveMatches, getRecentMatches
│   │   │   └── search.ts             # searchEntities
│   │   ├── utils/
│   │   │   ├── slugify.ts
│   │   │   ├── date.ts               # Season label formatting, date helpers
│   │   │   └── time-context.ts       # Season resolution logic
│   │   └── validators/               # Zod schemas
│   │       ├── player.ts
│   │       ├── team.ts
│   │       └── search.ts
│   │
│   ├── hooks/                        # Client-side hooks
│   │   ├── use-time-context.ts       # Season/Now state management
│   │   ├── use-search.ts             # Debounced search with autocomplete
│   │   └── use-live-matches.ts       # Polling for live scores
│   │
│   ├── types/                        # Shared TypeScript types
│   │   ├── entities.ts               # Player, Team, Competition, Match, etc.
│   │   ├── api.ts                    # API response shapes
│   │   └── time.ts                   # TimeView, SeasonContext
│   │
│   └── styles/                       # Global styles (from Figma export)
│       ├── tailwind.css
│       ├── fonts.css
│       └── theme.css
│
├── public/                           # Static assets
│   ├── images/
│   └── icons/
│
├── drizzle.config.ts                 # Drizzle Kit config
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local                        # DATABASE_URL, etc.
```

---

## 4. API Routes

### Page Data (Server Components — no API needed)

These are fetched directly in Server Components via `lib/queries/*`. No client-side API call required.

| Page | Data Function | Query |
|------|--------------|-------|
| Home | `getLiveMatches()`, `getTrendingPlayers()`, `getFeaturedTeams()` | Composite |
| Player | `getPlayer(slug)`, `getPlayerStats(id, seasonId?)` | By slug, season-aware |
| Team | `getTeam(slug)`, `getSquad(id, seasonId?)`, `getTeamStats(id, seasonId?)` | By slug, season-aware |
| Competition | `getCompetition(slug, season?)`, `getStandings(csId)`, `getTopScorers(csId)` | By slug + season |
| Match | `getMatch(id)`, `getMatchEvents(id)`, `getMatchLineups(id)` | By UUID |

### Client-Side API Routes (for dynamic interactions)

```
GET  /api/search?q={query}&type={player|team|competition|venue}&limit=10
     → Autocomplete + search results. Returns SearchResult[].

GET  /api/matches/live
     → Returns Match[] with status IN ('live', 'half_time').
     → Polled every 30s from client.

GET  /api/players/{id}/stats?season_id={uuid}
     → Season toggle fetches fresh stats without full page reload.
     → Returns PlayerSeasonStat[].

GET  /api/teams/{id}/squad?season_id={uuid}
     → Season toggle fetches squad for a given season.
     → Returns Player[] with shirt numbers and positions.

GET  /api/teams/{id}/stats?season_id={uuid}
     → Returns Standing for team in given season.

GET  /api/competitions/{id}/standings?season_id={uuid}
     → Returns Standing[] for competition-season.

GET  /api/seasons
     → Returns Season[] for populating dropdowns.
```

### URL Structure (matches your spec)

| Route | Rendering | Data |
|-------|-----------|------|
| `/` | SSR + ISR (60s) | Live matches, trending, featured |
| `/players/:slug` | SSR + ISR (300s) | Player profile, current stats |
| `/teams/:slug` | SSR + ISR (300s) | Team profile, current squad |
| `/competitions/:slug` | SSR, redirects to current season | Competition overview |
| `/competitions/:slug/:season` | SSR + ISR (60s for current, 86400 for past) | Standings, matches, top scorers |
| `/matches/:id` | SSR + client polling if live | Match detail, events, lineups |
| `/search?q=...` | SSR | Search results |

---

## 5. Implementation Roadmap

### Phase 0: Project Bootstrap — COMPLETE ✅
- [x] Initialize Next.js 15 project with App Router
- [x] Port Tailwind config, fonts, theme from Figma export
- [x] Port UI primitives (`/components/ui/*`) — direct copy
- [x] Set up Drizzle ORM + Neon Postgres connection
- [x] Run initial migration (all tables)
- [x] Seed database with sample data
- [x] Verify: `npm run dev` renders a blank layout with nav + footer

### Phase 1: Layout Shell + Search — COMPLETE ✅
- [x] Build root layout with Navbar and Footer
- [x] Implement search bar with Postgres full-text query
- [x] Build `/search` results page
- [x] Wire up navigation links
- [x] Deliverable: Search works across all entities

### Phase 2: Player Page — COMPLETE ✅
- [x] Build `getPlayer()` + `getPlayerStats()` + `getPlayerCareer()` queries
- [x] Build Player page Server Component at `/players/[slug]`
- [x] Player profile with stats, career history
- [x] AI-generated match performance summaries
- [x] Deliverable: Full player profiles with AI analysis

### Phase 3: Team Page — COMPLETE ✅
- [x] Build `getTeam()` + `getSquad()` + `getTeamStats()` queries
- [x] Build Team page at `/teams/[slug]`
- [x] Squad section with player links
- [x] Deliverable: Team pages with squad and stats

### Phase 4: Competition Page — COMPLETE ✅
- [x] Build `getCompetition()` + `getStandings()` + `getTopScorers()` queries
- [x] Build Competition page at `/competitions/[slug]`
- [x] Standings table with team links
- [x] Top scorers sidebar
- [x] Fixtures & Results section
- [x] AI-generated tournament recaps
- [x] Deliverable: Competition pages with standings, fixtures, AI recaps

### Phase 5: Match Page — COMPLETE ✅
- [x] Build `getMatch()` + `getMatchEvents()` + `getMatchLineups()` queries
- [x] Build Match page at `/matches/[id]`
- [x] Scoreboard hero, events timeline, lineups
- [x] Head-to-head component
- [x] Formation view
- [x] AI-generated match summaries with key moments & MOTM
- [x] Deliverable: Match detail page with AI analysis

### Phase 6: Home Page + Live — COMPLETE ✅
- [x] Build Home page with hero, stats, features
- [x] Live matches section with polling
- [x] Upcoming matches section (grouped by date)
- [x] Featured competitions, teams, players sections
- [x] Deliverable: Homepage with live data and upcoming fixtures

### Phase 7: Cross-Linking + SEO — COMPLETE ✅
- [x] All entity names are `<Link>` to their detail pages
- [x] Add `generateMetadata()` to all pages
- [x] Structured data (JSON-LD) for matches, players, teams, competitions
- [x] Internal linking components
- [x] Follow buttons for entities
- [x] Deliverable: Pages are crawlable, shareable, interlinked

### Phase 8: AI Content Generation — COMPLETE ✅
- [x] Database schema for AI summaries (matchSummaries, playerMatchSummaries, tournamentSummaries)
- [x] OpenAI GPT-3.5 integration for content generation
- [x] Match summary generation script (`scripts/generate-summaries.ts`)
- [x] Automated cron job (every 4 hours via Vercel)
- [x] Display components for AI content on match/player/competition pages
- [x] Deliverable: Auto-generated AI match reports

### Phase 9: Data Ingestion — COMPLETE ✅
- [x] Football-data.org API integration
- [x] Match fetching script (`scripts/fetch-matches.ts`)
- [x] Wikipedia data ingestion (`scripts/ingest-wikipedia.ts`)
- [x] 5 major leagues: Premier League, La Liga, Bundesliga, Serie A, Ligue 1
- [x] 1,100+ matches, 12,000+ players, 500+ teams
- [x] Deliverable: Real football data across top European leagues

### Phase 10: Future Enhancements — PLANNED
- [ ] User authentication & personalization
- [ ] Favorite teams/players with notifications
- [ ] Historical season archives
- [ ] Transfer news & rumors
- [ ] Advanced statistics (xG, pass maps, heatmaps)
- [ ] Mobile app (React Native)
- [ ] Real-time match updates via WebSocket
- [ ] Multi-language support (i18n)
- [ ] Dark mode theme

---

## 6. Key Architectural Decisions

### Time Context Pattern

The "Now / Season" toggle is a **client-side concern** that modifies API calls:

```typescript
// hooks/use-time-context.ts
type TimeContext = {
  mode: 'now' | 'season';
  seasonId: string | null;  // UUID of selected season
};
```

- **Now mode**: Queries use `WHERE valid_to IS NULL` (temporal) or current season (season-scoped).
- **Season mode**: Queries filter by the selected `season_id`.
- The URL reflects the season for competition pages (`/competitions/premier-league/2024-25`) but for player/team pages the toggle is client-state only (no URL change — the page is the entity, the season is a lens).

### Reusable Entity Hero

All entity pages share the same hero pattern (full-width image, gradient overlay, metadata row). This becomes a single `EntityHero` component:

```typescript
<EntityHero
  imageUrl={...}
  title="Erling Haaland"
  badges={[{ label: 'Active', color: 'green' }]}
  metadata={[
    { icon: ShirtIcon, label: '9' },
    { icon: MapPin, label: 'Norway' },
  ]}
/>
```

### Data Seeding Strategy

For MVP, we'll seed manually with a script that populates realistic but hardcoded data for:
- 1 competition (Premier League)
- 20 teams
- ~100 players (key players per team)
- 2 seasons (2024/25 completed, 2025/26 in progress)
- ~50 matches
- Standings for both seasons

This is enough to demonstrate all features. Real data ingestion (from APIs like football-data.org or transfermarkt) is a post-MVP concern.

---

## 7. Open Questions / Risks

| Risk | Mitigation |
|------|------------|
| Postgres full-text search may be slow on large datasets | Acceptable for MVP. Migration path: add Meilisearch behind the same API. |
| No real-time data source yet | Seed data is sufficient for MVP. Live match polling simulates real flow. |
| Next.js App Router complexity (RSC + client boundaries) | Clear convention: pages are Server Components, interactive sections (TimeToggle, search, live polling) are explicitly `'use client'`. |
| Image CDN costs / broken Unsplash links | Use `next/image` with a fallback component (already exists in Figma export as `ImageWithFallback`). |
| Drizzle migration drift | One-way migrations. Schema changes always go through `drizzle-kit generate`. |

---

## Next Step

Once you confirm this architecture, I'll start with **Phase 0**: scaffold the Next.js project, port the existing components, set up the database, and run the first migration.
