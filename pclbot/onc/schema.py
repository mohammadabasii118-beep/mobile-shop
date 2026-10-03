"""ONE NIGHT CHAMPION tables. All names start with onc_; nothing here touches the Transfer tables."""

SCHEMA = """
CREATE TABLE IF NOT EXISTS onc_tournaments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,             -- YYYY-MM-DD
    start_time TEXT NOT NULL,             -- HH:MM
    round_interval INTEGER NOT NULL CHECK(round_interval > 0),   -- minutes between ROUNDS (not between matches)
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','READY','LIVE','FINISHED','ARCHIVED')),
    is_active INTEGER NOT NULL DEFAULT 0,
    champion_team_id INTEGER,
    created_at INTEGER NOT NULL,
    created_by INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS onc_one_active ON onc_tournaments(is_active) WHERE is_active=1;

CREATE TABLE IF NOT EXISTS onc_teams(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    logo_file_id TEXT,
    UNIQUE(tournament_id, name));

CREATE TABLE IF NOT EXISTS onc_players(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES onc_teams(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL COLLATE NOCASE,
    UNIQUE(team_id, player_id));

CREATE TABLE IF NOT EXISTS onc_groups(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    qualifiers INTEGER CHECK(qualifiers IS NULL OR qualifiers >= 0),
    UNIQUE(tournament_id, name));

-- a team belongs to at most one group; moving a team never touches the team row itself
CREATE TABLE IF NOT EXISTS onc_group_members(
    team_id INTEGER PRIMARY KEY REFERENCES onc_teams(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES onc_groups(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS onc_rounds(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK(stage IN ('GROUP','R32','R16','QF','SF','F')),
    number INTEGER NOT NULL,
    start_at TEXT NOT NULL,               -- YYYY-MM-DD HH:MM  (all matches of the round start together)
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CONFIRMED')),
    content_version INTEGER NOT NULL DEFAULT 0,
    published_version INTEGER NOT NULL DEFAULT 0,
    UNIQUE(tournament_id, stage, number));

CREATE TABLE IF NOT EXISTS onc_matches(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL REFERENCES onc_rounds(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES onc_groups(id) ON DELETE CASCADE,
    team_a INTEGER NOT NULL REFERENCES onc_teams(id) ON DELETE CASCADE,
    team_b INTEGER NOT NULL REFERENCES onc_teams(id) ON DELETE CASCADE,
    CHECK(team_a <> team_b));
-- single round robin: two teams of one group meet only once
CREATE UNIQUE INDEX IF NOT EXISTS onc_pair_once ON onc_matches(group_id, MIN(team_a, team_b), MAX(team_a, team_b))
    WHERE group_id IS NOT NULL;

-- a team plays at most one match per round
CREATE TABLE IF NOT EXISTS onc_match_participants(
    round_id INTEGER NOT NULL REFERENCES onc_rounds(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES onc_teams(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES onc_matches(id) ON DELETE CASCADE,
    PRIMARY KEY(round_id, team_id));

-- match results are the single source of truth; standings/qualification are always computed from CONFIRMED rows
CREATE TABLE IF NOT EXISTS onc_results(
    match_id INTEGER PRIMARY KEY REFERENCES onc_matches(id) ON DELETE CASCADE,
    goals_a INTEGER NOT NULL CHECK(goals_a >= 0),
    goals_b INTEGER NOT NULL CHECK(goals_b >= 0),
    winner_team_id INTEGER REFERENCES onc_teams(id),     -- knockout only
    status TEXT NOT NULL DEFAULT 'SAVED' CHECK(status IN ('SAVED','CONFIRMED')),
    updated_at INTEGER NOT NULL,
    updated_by INTEGER);

-- admin decision for an unresolved tie; valid only while the tied set (signature) is unchanged
CREATE TABLE IF NOT EXISTS onc_tie_decisions(
    group_id INTEGER NOT NULL REFERENCES onc_groups(id) ON DELETE CASCADE,
    signature TEXT NOT NULL,
    order_json TEXT NOT NULL,
    PRIMARY KEY(group_id, signature));

CREATE TABLE IF NOT EXISTS onc_template_sets(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS onc_templates(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL REFERENCES onc_template_sets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('SCHEDULE','GROUP_TABLE','ROUND_RESULTS','QUALIFIED','KO_MATCHES','BRACKET','CHAMPION')),
    name TEXT NOT NULL,
    bg_path TEXT,
    config TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS onc_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS onc_publications(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES onc_tournaments(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    kind TEXT NOT NULL,                   -- RESULTS, STANDINGS, SCHEDULE, QUALIFIED, KO_MATCHES, BRACKET, CHAMPION
    ref_id INTEGER NOT NULL DEFAULT 0,    -- round id (RESULTS/KO_MATCHES/STANDINGS) or 0
    page INTEGER NOT NULL DEFAULT 1,
    channel_id TEXT NOT NULL,
    message_id INTEGER NOT NULL,
    published_at INTEGER NOT NULL,
    published_by INTEGER,
    content_version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(tournament_id, kind, ref_id, page, channel_id));

CREATE TABLE IF NOT EXISTS onc_audit(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    admin_id INTEGER,
    tournament_id INTEGER,
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '');
"""
