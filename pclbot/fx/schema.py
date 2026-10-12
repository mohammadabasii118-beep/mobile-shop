FX_SCHEMA = """
CREATE TABLE IF NOT EXISTS fx_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- ---- international (USDT) subscriptions: a receipt is sent, an admin approves it ----------------------------------
CREATE TABLE IF NOT EXISTS fx_subs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan TEXT NOT NULL CHECK(plan IN ('std','pro')),
    months INTEGER NOT NULL CHECK(months IN (6,12)),
    amount TEXT NOT NULL,                 -- USDT, as shown to the user at purchase time
    status TEXT NOT NULL DEFAULT 'AWAITING' CHECK(status IN ('AWAITING','PENDING','ACTIVE','REJECTED')),
    receipt_file TEXT, receipt_text TEXT,
    created_at INTEGER NOT NULL, decided_at INTEGER, decided_by INTEGER,
    starts_at INTEGER, expires_at INTEGER, reject_reason TEXT);
CREATE INDEX IF NOT EXISTS fx_subs_user ON fx_subs(user_id, status);

-- ---- blacklist (keyed by the player's in-game ID) -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_blacklist(
    player_id TEXT PRIMARY KEY COLLATE NOCASE, reason TEXT NOT NULL, added_by INTEGER, added_at INTEGER NOT NULL);

-- ---- draft registration --------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_draft_regs(
    user_id INTEGER PRIMARY KEY, gaming_id TEXT NOT NULL, pos1 TEXT NOT NULL, pos2 TEXT, created_at INTEGER NOT NULL);

-- ---- streamers -----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_streamers(user_id INTEGER PRIMARY KEY, added_by INTEGER, added_at INTEGER NOT NULL, username TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS fx_stream_posts(
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, chat_id TEXT, message_id INTEGER, created_at INTEGER NOT NULL);

-- ---- football quiz contests ----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_q_questions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK(level IN ('easy','medium','hard')),
    text TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, c TEXT NOT NULL, d TEXT NOT NULL,
    correct INTEGER NOT NULL CHECK(correct BETWEEN 0 AND 3),
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(text));
CREATE TABLE IF NOT EXISTS fx_q_contests(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, prize TEXT NOT NULL DEFAULT '',
    start_at TEXT NOT NULL,                              -- local (Asia/Tehran) 'YYYY-MM-DD HH:MM'
    n_easy INTEGER NOT NULL DEFAULT 0, n_medium INTEGER NOT NULL DEFAULT 0, n_hard INTEGER NOT NULL DEFAULT 0,
    seconds INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'REG' CHECK(status IN ('REG','RUNNING','DONE','CANCELLED')),
    reminded INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER, created_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER);
CREATE TABLE IF NOT EXISTS fx_q_regs(
    contest_id INTEGER NOT NULL REFERENCES fx_q_contests(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, joined_at INTEGER NOT NULL,
    PRIMARY KEY(contest_id, user_id));
CREATE TABLE IF NOT EXISTS fx_q_cq(                      -- the questions of one contest, in order, with the shuffled option order
    contest_id INTEGER NOT NULL REFERENCES fx_q_contests(id) ON DELETE CASCADE, idx INTEGER NOT NULL,
    question_id INTEGER NOT NULL REFERENCES fx_q_questions(id), perm TEXT NOT NULL, PRIMARY KEY(contest_id, idx));
CREATE TABLE IF NOT EXISTS fx_q_answers(
    contest_id INTEGER NOT NULL, idx INTEGER NOT NULL, user_id INTEGER NOT NULL, choice INTEGER NOT NULL, ms INTEGER NOT NULL, correct INTEGER NOT NULL,
    PRIMARY KEY(contest_id, idx, user_id));
CREATE TABLE IF NOT EXISTS fx_q_results(
    contest_id INTEGER NOT NULL REFERENCES fx_q_contests(id) ON DELETE CASCADE, user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '', score INTEGER NOT NULL, total_ms INTEGER NOT NULL, rank INTEGER NOT NULL,
    PRIMARY KEY(contest_id, user_id));

-- ---- team of the tournament: the unfinished work of an admin (survives restarts) + players seen before (re-usable data)
CREATE TABLE IF NOT EXISTS fx_xi_drafts(admin_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS fx_xi_known(
    player_id TEXT PRIMARY KEY COLLATE NOCASE, team_name TEXT, photo_file TEXT, logo_file TEXT, updated_at INTEGER NOT NULL);

-- ---- Here We Go (transfers from the PCL app API) -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_hwg_seen(id TEXT PRIMARY KEY, posted_at INTEGER NOT NULL);
"""
