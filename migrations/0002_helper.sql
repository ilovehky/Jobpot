-- Step 2: helper pairing, schedule settings, runs, and found jobs.

CREATE TABLE pairing_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX pairing_codes_user_id ON pairing_codes(user_id);

-- Long-lived token the helper uses instead of a browser cookie. Only the hash is stored.
CREATE TABLE helper_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX helper_tokens_user_id ON helper_tokens(user_id);

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  search_time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  max_minutes INTEGER NOT NULL,
  -- NULL means no cap on AI requests.
  max_requests INTEGER,
  max_jobs INTEGER NOT NULL,
  sites TEXT NOT NULL,
  closest_cutoff INTEGER NOT NULL DEFAULT 75,
  reach_cutoff INTEGER NOT NULL DEFAULT 50,
  ai_consent INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

ALTER TABLE profiles ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN summary_updated_at INTEGER;

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  ai_requests INTEGER,
  jobs_found INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX runs_user_started ON runs(user_id, started_at);

-- The tier is not stored: it is derived from score and the user's cutoffs, so editing cutoffs regroups old jobs.
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  work_type TEXT NOT NULL,
  source TEXT NOT NULL,
  apply_url TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  found_at INTEGER NOT NULL,
  UNIQUE (user_id, url)
);
CREATE INDEX jobs_user_found ON jobs(user_id, found_at);
