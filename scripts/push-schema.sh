#!/bin/bash
CONN="postgresql://neondb_owner:npg_2dhnGVLu6BaI@ep-red-mode-ai0u9j1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
HOST="ep-red-mode-ai0u9j1x-pooler.c-4.us-east-1.aws.neon.tech"

run_sql() {
  local query="$1"
  local escaped=$(echo "$query" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
  local body="{\"query\": $escaped}"
  local result=$(curl -s "https://${HOST}/sql" \
    -H "Content-Type: application/json" \
    -H "Neon-Connection-String: ${CONN}" \
    -d "$body")
  
  # Check for error
  if echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'rows' in d or 'command' in d else 1)" 2>/dev/null; then
    return 0
  else
    echo "ERROR: $result"
    return 1
  fi
}

echo "🗄️  Pushing schema to Neon..."

# Enable UUID extension
run_sql "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";" && echo "✅ pgcrypto extension"

# Seasons
run_sql "CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ seasons"

# Competitions
run_sql "CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country TEXT,
  type TEXT NOT NULL,
  founded_year INT,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ competitions"

# Teams
run_sql "CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  slug TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  city TEXT,
  founded_year INT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ teams"

# Players
run_sql "CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  known_as TEXT,
  slug TEXT NOT NULL UNIQUE,
  date_of_birth DATE,
  nationality TEXT,
  second_nationality TEXT,
  height_cm INT,
  position TEXT NOT NULL,
  preferred_foot TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ players"

# Venues
run_sql "CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT,
  country TEXT,
  capacity INT,
  opened_year INT,
  image_url TEXT,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ venues"

# Player Team History
run_sql "CREATE TABLE IF NOT EXISTS player_team_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  shirt_number INT,
  valid_from DATE NOT NULL,
  valid_to DATE,
  transfer_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ player_team_history"

# Team Venue History
run_sql "CREATE TABLE IF NOT EXISTS team_venue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  venue_id UUID NOT NULL REFERENCES venues(id),
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ team_venue_history"

# Competition Seasons
run_sql "CREATE TABLE IF NOT EXISTS competition_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  status TEXT NOT NULL DEFAULT 'scheduled',
  champion_team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competition_id, season_id)
);" && echo "✅ competition_seasons"

# Standings
run_sql "CREATE TABLE IF NOT EXISTS standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  position INT NOT NULL,
  played INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  drawn INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  goals_for INT NOT NULL DEFAULT 0,
  goals_against INT NOT NULL DEFAULT 0,
  goal_difference INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  form TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competition_season_id, team_id)
);" && echo "✅ standings"

# Team Seasons
run_sql "CREATE TABLE IF NOT EXISTS team_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, competition_season_id)
);" && echo "✅ team_seasons"

# Matches
run_sql "CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  venue_id UUID REFERENCES venues(id),
  matchday INT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  home_score INT,
  away_score INT,
  attendance INT,
  referee TEXT,
  minute INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ matches"

# Match Events
run_sql "CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  type TEXT NOT NULL,
  minute INT NOT NULL,
  added_time INT,
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id UUID REFERENCES players(id),
  secondary_player_id UUID REFERENCES players(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ match_events"

# Match Lineups
run_sql "CREATE TABLE IF NOT EXISTS match_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id UUID NOT NULL REFERENCES players(id),
  shirt_number INT,
  position TEXT,
  is_starter BOOLEAN NOT NULL DEFAULT true,
  minutes_played INT,
  rating DECIMAL(3,1),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, player_id)
);" && echo "✅ match_lineups"

# Player Season Stats
run_sql "CREATE TABLE IF NOT EXISTS player_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  competition_season_id UUID NOT NULL REFERENCES competition_seasons(id),
  appearances INT NOT NULL DEFAULT 0,
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  yellow_cards INT NOT NULL DEFAULT 0,
  red_cards INT NOT NULL DEFAULT 0,
  minutes_played INT NOT NULL DEFAULT 0,
  clean_sheets INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, team_id, competition_season_id)
);" && echo "✅ player_season_stats"

# Search Index
run_sql "CREATE TABLE IF NOT EXISTS search_index (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  meta TEXT,
  search_vector TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);" && echo "✅ search_index"

# Indexes
run_sql "CREATE INDEX IF NOT EXISTS idx_pth_player ON player_team_history(player_id);" 
run_sql "CREATE INDEX IF NOT EXISTS idx_pth_team ON player_team_history(team_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_matches_scheduled ON matches(scheduled_at);"
run_sql "CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);"
run_sql "CREATE INDEX IF NOT EXISTS idx_matches_cs ON matches(competition_season_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_standings_cs ON standings(competition_season_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_pss_player ON player_season_stats(player_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_pss_cs ON player_season_stats(competition_season_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_match_lineups_match ON match_lineups(match_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_search_entity_type ON search_index(entity_type);"
run_sql "CREATE INDEX IF NOT EXISTS idx_players_slug ON players(slug);"
run_sql "CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);"
run_sql "CREATE INDEX IF NOT EXISTS idx_competitions_slug ON competitions(slug);"
echo "✅ indexes"

echo ""
echo "🎉 Schema push complete!"
