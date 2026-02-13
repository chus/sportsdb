#!/bin/bash
CONN="postgresql://neondb_owner:npg_2dhnGVLu6BaI@ep-red-mode-ai0u9j1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
HOST="ep-red-mode-ai0u9j1x-pooler.c-4.us-east-1.aws.neon.tech"

run_sql() {
  local query="$1"
  local escaped=$(echo "$query" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
  local body="{\"query\": $escaped}"
  curl -s "https://${HOST}/sql" \
    -H "Content-Type: application/json" \
    -H "Neon-Connection-String: ${CONN}" \
    -d "$body"
}

get_id() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin)['rows'][0]['id'])"
}

echo "🌱 Seeding database..."

# Seasons
S2425=$(run_sql "INSERT INTO seasons (label, start_date, end_date, is_current) VALUES ('2024/25', '2024-08-10', '2025-05-25', false) RETURNING id;")
S2425_ID=$(get_id "$S2425")
S2526=$(run_sql "INSERT INTO seasons (label, start_date, end_date, is_current) VALUES ('2025/26', '2025-08-09', '2026-05-24', true) RETURNING id;")
S2526_ID=$(get_id "$S2526")
echo "✅ Seasons: $S2425_ID, $S2526_ID"

# Competition
PL=$(run_sql "INSERT INTO competitions (name, slug, country, type, founded_year, description) VALUES ('Premier League', 'premier-league', 'England', 'league', 1992, 'The top tier of English football') RETURNING id;")
PL_ID=$(get_id "$PL")
echo "✅ Competition: $PL_ID"

# Competition Seasons
CS2425=$(run_sql "INSERT INTO competition_seasons (competition_id, season_id, status) VALUES ('$PL_ID', '$S2425_ID', 'completed') RETURNING id;")
CS2425_ID=$(get_id "$CS2425")
CS2526=$(run_sql "INSERT INTO competition_seasons (competition_id, season_id, status) VALUES ('$PL_ID', '$S2526_ID', 'in_progress') RETURNING id;")
CS2526_ID=$(get_id "$CS2526")
echo "✅ Competition Seasons"

# Venues
V1=$(run_sql "INSERT INTO venues (name,slug,city,country,capacity,opened_year) VALUES ('Etihad Stadium','etihad-stadium','Manchester','England',53400,2003) RETURNING id;")
V1_ID=$(get_id "$V1")
V2=$(run_sql "INSERT INTO venues (name,slug,city,country,capacity,opened_year) VALUES ('Emirates Stadium','emirates-stadium','London','England',60704,2006) RETURNING id;")
V2_ID=$(get_id "$V2")
V3=$(run_sql "INSERT INTO venues (name,slug,city,country,capacity,opened_year) VALUES ('Anfield','anfield','Liverpool','England',61276,1884) RETURNING id;")
V3_ID=$(get_id "$V3")
V4=$(run_sql "INSERT INTO venues (name,slug,city,country,capacity,opened_year) VALUES ('Stamford Bridge','stamford-bridge','London','England',40341,1877) RETURNING id;")
V4_ID=$(get_id "$V4")
V5=$(run_sql "INSERT INTO venues (name,slug,city,country,capacity,opened_year) VALUES ('Old Trafford','old-trafford','Manchester','England',74310,1910) RETURNING id;")
V5_ID=$(get_id "$V5")
V6=$(run_sql "INSERT INTO venues (name,slug,city,country,capacity,opened_year) VALUES ('Tottenham Hotspur Stadium','tottenham-hotspur-stadium','London','England',62850,2019) RETURNING id;")
V6_ID=$(get_id "$V6")
echo "✅ Venues"

# Teams
T1=$(run_sql "INSERT INTO teams (name,short_name,slug,country,city,founded_year,primary_color,secondary_color) VALUES ('Manchester City','Man City','manchester-city','England','Manchester',1880,'#6CABDD','#1C2C5B') RETURNING id;")
T1_ID=$(get_id "$T1")
T2=$(run_sql "INSERT INTO teams (name,short_name,slug,country,city,founded_year,primary_color,secondary_color) VALUES ('Arsenal','Arsenal','arsenal','England','London',1886,'#EF0107','#063672') RETURNING id;")
T2_ID=$(get_id "$T2")
T3=$(run_sql "INSERT INTO teams (name,short_name,slug,country,city,founded_year,primary_color,secondary_color) VALUES ('Liverpool','Liverpool','liverpool','England','Liverpool',1892,'#C8102E','#00B2A9') RETURNING id;")
T3_ID=$(get_id "$T3")
T4=$(run_sql "INSERT INTO teams (name,short_name,slug,country,city,founded_year,primary_color,secondary_color) VALUES ('Chelsea','Chelsea','chelsea','England','London',1905,'#034694','#DBA111') RETURNING id;")
T4_ID=$(get_id "$T4")
T5=$(run_sql "INSERT INTO teams (name,short_name,slug,country,city,founded_year,primary_color,secondary_color) VALUES ('Manchester United','Man Utd','manchester-united','England','Manchester',1878,'#DA291C','#FBE122') RETURNING id;")
T5_ID=$(get_id "$T5")
T6=$(run_sql "INSERT INTO teams (name,short_name,slug,country,city,founded_year,primary_color,secondary_color) VALUES ('Tottenham Hotspur','Spurs','tottenham-hotspur','England','London',1882,'#132257','#FFFFFF') RETURNING id;")
T6_ID=$(get_id "$T6")
echo "✅ Teams: MC=$T1_ID ARS=$T2_ID LIV=$T3_ID CHE=$T4_ID MUN=$T5_ID TOT=$T6_ID"

# Team Venue History
run_sql "INSERT INTO team_venue_history (team_id,venue_id,valid_from) VALUES ('$T1_ID','$V1_ID','2003-01-01'),('$T2_ID','$V2_ID','2006-01-01'),('$T3_ID','$V3_ID','1884-01-01'),('$T4_ID','$V4_ID','1905-01-01'),('$T5_ID','$V5_ID','1910-01-01'),('$T6_ID','$V6_ID','2019-01-01');" > /dev/null
echo "✅ Team-Venue links"

# Team Seasons
run_sql "INSERT INTO team_seasons (team_id,competition_season_id) VALUES ('$T1_ID','$CS2425_ID'),('$T1_ID','$CS2526_ID'),('$T2_ID','$CS2425_ID'),('$T2_ID','$CS2526_ID'),('$T3_ID','$CS2425_ID'),('$T3_ID','$CS2526_ID'),('$T4_ID','$CS2425_ID'),('$T4_ID','$CS2526_ID'),('$T5_ID','$CS2425_ID'),('$T5_ID','$CS2526_ID'),('$T6_ID','$CS2425_ID'),('$T6_ID','$CS2526_ID');" > /dev/null
echo "✅ Team Seasons"

# Players — insert and capture IDs
insert_player() {
  local name="$1" known="$2" slug="$3" dob="$4" nat="$5" height="$6" pos="$7" foot="$8" team_id="$9" shirt="${10}" vfrom="${11}"
  local result=$(run_sql "INSERT INTO players (name,known_as,slug,date_of_birth,nationality,height_cm,position,preferred_foot,status) VALUES ('$name','$known','$slug','$dob','$nat',$height,'$pos','$foot','active') RETURNING id;")
  local pid=$(get_id "$result")
  run_sql "INSERT INTO player_team_history (player_id,team_id,shirt_number,valid_from,transfer_type) VALUES ('$pid','$team_id',$shirt,'$vfrom','permanent');" > /dev/null
  echo "$pid"
}

# Man City
P_HAALAND=$(insert_player "Erling Haaland" "Haaland" "erling-haaland" "2000-07-21" "Norway" 195 "Forward" "Left" "$T1_ID" 9 "2022-07-01")
P_KDB=$(insert_player "Kevin De Bruyne" "De Bruyne" "kevin-de-bruyne" "1991-06-28" "Belgium" 181 "Midfielder" "Right" "$T1_ID" 17 "2015-08-30")
P_FODEN=$(insert_player "Phil Foden" "Foden" "phil-foden" "2000-05-28" "England" 171 "Midfielder" "Left" "$T1_ID" 47 "2017-07-01")
P_RODRI=$(insert_player "Rodri Hernandez" "Rodri" "rodri" "1996-06-22" "Spain" 191 "Midfielder" "Right" "$T1_ID" 16 "2019-07-04")
P_EDERSON=$(insert_player "Ederson Moraes" "Ederson" "ederson" "1993-08-17" "Brazil" 188 "Goalkeeper" "Left" "$T1_ID" 31 "2017-07-01")
echo "✅ Man City players"

# Arsenal
P_SAKA=$(insert_player "Bukayo Saka" "Saka" "bukayo-saka" "2001-09-05" "England" 178 "Forward" "Left" "$T2_ID" 7 "2019-01-01")
P_ODEGAARD=$(insert_player "Martin Odegaard" "Odegaard" "martin-odegaard" "1998-12-17" "Norway" 178 "Midfielder" "Left" "$T2_ID" 8 "2021-08-20")
P_SALIBA=$(insert_player "William Saliba" "Saliba" "william-saliba" "2001-03-24" "France" 192 "Defender" "Right" "$T2_ID" 2 "2022-07-01")
P_RICE=$(insert_player "Declan Rice" "Rice" "declan-rice" "1999-01-14" "England" 188 "Midfielder" "Right" "$T2_ID" 41 "2023-07-15")
echo "✅ Arsenal players"

# Liverpool
P_SALAH=$(insert_player "Mohamed Salah" "Salah" "mohamed-salah" "1992-06-15" "Egypt" 175 "Forward" "Left" "$T3_ID" 11 "2017-06-22")
P_VVD=$(insert_player "Virgil van Dijk" "Van Dijk" "virgil-van-dijk" "1991-07-08" "Netherlands" 193 "Defender" "Right" "$T3_ID" 4 "2018-01-01")
P_TAA=$(insert_player "Trent Alexander-Arnold" "TAA" "trent-alexander-arnold" "1998-10-07" "England" 180 "Defender" "Right" "$T3_ID" 66 "2016-10-01")
echo "✅ Liverpool players"

# Chelsea
P_PALMER=$(insert_player "Cole Palmer" "Palmer" "cole-palmer" "2002-05-06" "England" 189 "Forward" "Left" "$T4_ID" 20 "2023-09-01")
P_ENZO=$(insert_player "Enzo Fernandez" "Enzo" "enzo-fernandez" "2001-01-17" "Argentina" 178 "Midfielder" "Right" "$T4_ID" 8 "2023-02-01")
echo "✅ Chelsea players"

# Man Utd
P_BRUNO=$(insert_player "Bruno Fernandes" "Bruno" "bruno-fernandes" "1994-09-08" "Portugal" 179 "Midfielder" "Right" "$T5_ID" 8 "2020-01-30")
P_RASHFORD=$(insert_player "Marcus Rashford" "Rashford" "marcus-rashford" "1997-10-31" "England" 185 "Forward" "Right" "$T5_ID" 10 "2015-11-01")
echo "✅ Man Utd players"

# Spurs
P_SON=$(insert_player "Son Heung-min" "Son" "son-heung-min" "1992-07-08" "South Korea" 183 "Forward" "Both" "$T6_ID" 7 "2015-08-28")
P_MADDISON=$(insert_player "James Maddison" "Maddison" "james-maddison" "1996-11-23" "England" 175 "Midfielder" "Right" "$T6_ID" 10 "2023-06-26")
echo "✅ Spurs players"

# Player Season Stats (2025/26)
run_sql "INSERT INTO player_season_stats (player_id,team_id,competition_season_id,appearances,goals,assists,yellow_cards,red_cards,minutes_played,clean_sheets) VALUES
('$P_HAALAND','$T1_ID','$CS2526_ID',28,32,8,2,0,2240,0),
('$P_KDB','$T1_ID','$CS2526_ID',22,6,16,3,0,1760,0),
('$P_FODEN','$T1_ID','$CS2526_ID',26,12,9,1,0,2080,0),
('$P_RODRI','$T1_ID','$CS2526_ID',27,3,4,5,0,2430,0),
('$P_SAKA','$T2_ID','$CS2526_ID',27,21,11,2,0,2295,0),
('$P_ODEGAARD','$T2_ID','$CS2526_ID',25,8,14,1,0,2125,0),
('$P_RICE','$T2_ID','$CS2526_ID',28,5,7,4,0,2520,0),
('$P_SALAH','$T3_ID','$CS2526_ID',28,24,13,1,0,2380,0),
('$P_VVD','$T3_ID','$CS2526_ID',27,3,1,3,0,2430,0),
('$P_TAA','$T3_ID','$CS2526_ID',25,2,10,2,0,2125,0),
('$P_PALMER','$T4_ID','$CS2526_ID',27,18,10,0,0,2295,0),
('$P_ENZO','$T4_ID','$CS2526_ID',26,4,8,4,0,2210,0),
('$P_BRUNO','$T5_ID','$CS2526_ID',28,10,12,5,0,2520,0),
('$P_RASHFORD','$T5_ID','$CS2526_ID',24,8,5,2,0,1920,0),
('$P_SON','$T6_ID','$CS2526_ID',26,16,7,1,0,2210,0),
('$P_MADDISON','$T6_ID','$CS2526_ID',23,7,9,3,0,1840,0);" > /dev/null
echo "✅ Player Season Stats"

# Standings 2025/26
run_sql "INSERT INTO standings (competition_season_id,team_id,position,played,won,drawn,lost,goals_for,goals_against,goal_difference,points,form) VALUES
('$CS2526_ID','$T1_ID',1,28,22,4,2,68,20,48,70,'WWWDW'),
('$CS2526_ID','$T2_ID',2,28,20,5,3,62,25,37,65,'WWDWW'),
('$CS2526_ID','$T3_ID',3,28,19,6,3,58,24,34,63,'WDWWL'),
('$CS2526_ID','$T4_ID',4,28,17,7,4,54,28,26,58,'DWWLW'),
('$CS2526_ID','$T5_ID',5,28,16,6,6,50,32,18,54,'WLWDW'),
('$CS2526_ID','$T6_ID',6,28,15,5,8,52,38,14,50,'LWWDL');" > /dev/null
echo "✅ Standings"

# Standings 2024/25 (completed season)
run_sql "INSERT INTO standings (competition_season_id,team_id,position,played,won,drawn,lost,goals_for,goals_against,goal_difference,points,form) VALUES
('$CS2425_ID','$T1_ID',1,38,29,5,4,96,34,62,92,'WWWWW'),
('$CS2425_ID','$T2_ID',2,38,27,6,5,88,38,50,87,'WDWWW'),
('$CS2425_ID','$T3_ID',3,38,25,8,5,82,36,46,83,'WWDWW'),
('$CS2425_ID','$T4_ID',4,38,22,8,8,72,44,28,74,'WDWLW'),
('$CS2425_ID','$T5_ID',5,38,20,7,11,64,52,12,67,'LWWDL'),
('$CS2425_ID','$T6_ID',6,38,18,6,14,58,56,2,60,'WLLDW');" > /dev/null

# Set champion for 2024/25
run_sql "UPDATE competition_seasons SET champion_team_id = '$T1_ID' WHERE id = '$CS2425_ID';" > /dev/null
echo "✅ 2024/25 Standings + Champion"

# Matches
M1=$(run_sql "INSERT INTO matches (competition_season_id,home_team_id,away_team_id,venue_id,matchday,scheduled_at,status,home_score,away_score,attendance,referee) VALUES ('$CS2526_ID','$T1_ID','$T3_ID','$V1_ID',28,'2026-02-08T16:30:00Z','finished',2,1,53284,'Michael Oliver') RETURNING id;")
M1_ID=$(get_id "$M1")
M2=$(run_sql "INSERT INTO matches (competition_season_id,home_team_id,away_team_id,venue_id,matchday,scheduled_at,status,home_score,away_score,attendance,referee) VALUES ('$CS2526_ID','$T2_ID','$T4_ID','$V2_ID',28,'2026-02-08T14:00:00Z','finished',3,1,60542,'Anthony Taylor') RETURNING id;")
M2_ID=$(get_id "$M2")
M3=$(run_sql "INSERT INTO matches (competition_season_id,home_team_id,away_team_id,venue_id,matchday,scheduled_at,status,home_score,away_score,attendance,referee) VALUES ('$CS2526_ID','$T5_ID','$T6_ID','$V5_ID',28,'2026-02-07T20:00:00Z','finished',1,1,73864,'Craig Pawson') RETURNING id;")
M3_ID=$(get_id "$M3")
M4=$(run_sql "INSERT INTO matches (competition_season_id,home_team_id,away_team_id,venue_id,matchday,scheduled_at,status) VALUES ('$CS2526_ID','$T3_ID','$T2_ID','$V3_ID',29,'2026-02-15T16:30:00Z','scheduled') RETURNING id;")
M4_ID=$(get_id "$M4")
M5=$(run_sql "INSERT INTO matches (competition_season_id,home_team_id,away_team_id,venue_id,matchday,scheduled_at,status) VALUES ('$CS2526_ID','$T4_ID','$T1_ID','$V4_ID',29,'2026-02-15T14:00:00Z','scheduled') RETURNING id;")
M5_ID=$(get_id "$M5")
echo "✅ Matches"

# Match Events for Man City vs Liverpool
run_sql "INSERT INTO match_events (match_id,type,minute,team_id,player_id,secondary_player_id,description) VALUES
('$M1_ID','goal',12,'$T1_ID','$P_HAALAND','$P_KDB','Haaland heads in from De Bruyne cross'),
('$M1_ID','goal',34,'$T3_ID','$P_SALAH','$P_TAA','Salah finishes from TAA through ball'),
('$M1_ID','goal',67,'$T1_ID','$P_FODEN',NULL,'Foden strikes from edge of box'),
('$M1_ID','yellow_card',72,'$T1_ID','$P_RODRI',NULL,NULL);" > /dev/null

# Match Events for Arsenal vs Chelsea
run_sql "INSERT INTO match_events (match_id,type,minute,team_id,player_id,secondary_player_id,description) VALUES
('$M2_ID','goal',15,'$T2_ID','$P_SAKA','$P_ODEGAARD','Saka curls in from the right'),
('$M2_ID','goal',38,'$T4_ID','$P_PALMER',NULL,'Palmer free kick into top corner'),
('$M2_ID','goal',55,'$T2_ID','$P_RICE',NULL,'Rice header from corner'),
('$M2_ID','goal',78,'$T2_ID','$P_SAKA','$P_RICE','Saka doubles up on the counter');" > /dev/null

# Match Events for Man Utd vs Spurs
run_sql "INSERT INTO match_events (match_id,type,minute,team_id,player_id,description) VALUES
('$M3_ID','goal',22,'$T5_ID','$P_BRUNO','Bruno penalty'),
('$M3_ID','goal',64,'$T6_ID','$P_SON','Son equaliser from tight angle'),
('$M3_ID','yellow_card',45,'$T5_ID','$P_RASHFORD',NULL),
('$M3_ID','yellow_card',68,'$T6_ID','$P_MADDISON',NULL);" > /dev/null
echo "✅ Match Events"

# Search Index
run_sql "INSERT INTO search_index (id,entity_type,slug,name,subtitle,meta) VALUES
('$P_HAALAND','player','erling-haaland','Erling Haaland','Manchester City','Forward'),
('$P_KDB','player','kevin-de-bruyne','Kevin De Bruyne','Manchester City','Midfielder'),
('$P_FODEN','player','phil-foden','Phil Foden','Manchester City','Midfielder'),
('$P_RODRI','player','rodri','Rodri Hernandez','Manchester City','Midfielder'),
('$P_EDERSON','player','ederson','Ederson Moraes','Manchester City','Goalkeeper'),
('$P_SAKA','player','bukayo-saka','Bukayo Saka','Arsenal','Forward'),
('$P_ODEGAARD','player','martin-odegaard','Martin Odegaard','Arsenal','Midfielder'),
('$P_SALIBA','player','william-saliba','William Saliba','Arsenal','Defender'),
('$P_RICE','player','declan-rice','Declan Rice','Arsenal','Midfielder'),
('$P_SALAH','player','mohamed-salah','Mohamed Salah','Liverpool','Forward'),
('$P_VVD','player','virgil-van-dijk','Virgil van Dijk','Liverpool','Defender'),
('$P_TAA','player','trent-alexander-arnold','Trent Alexander-Arnold','Liverpool','Defender'),
('$P_PALMER','player','cole-palmer','Cole Palmer','Chelsea','Forward'),
('$P_ENZO','player','enzo-fernandez','Enzo Fernandez','Chelsea','Midfielder'),
('$P_BRUNO','player','bruno-fernandes','Bruno Fernandes','Manchester United','Midfielder'),
('$P_RASHFORD','player','marcus-rashford','Marcus Rashford','Manchester United','Forward'),
('$P_SON','player','son-heung-min','Son Heung-min','Tottenham Hotspur','Forward'),
('$P_MADDISON','player','james-maddison','James Maddison','Tottenham Hotspur','Midfielder'),
('$T1_ID','team','manchester-city','Manchester City','Premier League','England'),
('$T2_ID','team','arsenal','Arsenal','Premier League','England'),
('$T3_ID','team','liverpool','Liverpool','Premier League','England'),
('$T4_ID','team','chelsea','Chelsea','Premier League','England'),
('$T5_ID','team','manchester-united','Manchester United','Premier League','England'),
('$T6_ID','team','tottenham-hotspur','Tottenham Hotspur','Premier League','England'),
('$PL_ID','competition','premier-league','Premier League','England','league'),
('$V1_ID','venue','etihad-stadium','Etihad Stadium','Manchester','England'),
('$V2_ID','venue','emirates-stadium','Emirates Stadium','London','England'),
('$V3_ID','venue','anfield','Anfield','Liverpool','England'),
('$V4_ID','venue','stamford-bridge','Stamford Bridge','London','England'),
('$V5_ID','venue','old-trafford','Old Trafford','Manchester','England'),
('$V6_ID','venue','tottenham-hotspur-stadium','Tottenham Hotspur Stadium','London','England');" > /dev/null
echo "✅ Search Index"

echo ""
echo "🎉 Seed complete!"
echo "   18 players, 6 teams, 6 venues, 5 matches"
echo "   Standings for 2024/25 and 2025/26"
echo "   Match events for 3 matches"
echo "   31 search index entries"
