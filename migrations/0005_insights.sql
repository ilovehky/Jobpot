-- Step 6: one insights analysis per user (rejected and no-reply jobs), written by the user's AI agent.
CREATE TABLE insights (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  -- JSON list of the job ids the analysis covered, so the helper knows when new jobs need a refresh.
  job_ids TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT '',
  ai_requests INTEGER,
  updated_at INTEGER NOT NULL
);
