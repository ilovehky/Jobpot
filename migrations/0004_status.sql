-- Step 5: application status from Gmail, status history, and outreach drafts.

ALTER TABLE jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'applied';
ALTER TABLE jobs ADD COLUMN status_at INTEGER;
-- 1 when an email suggested a change Jobpot wasn't sure about; the user confirms it on the Applied tab.
ALTER TABLE jobs ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;

-- One row per status change, from Gmail or set by hand. quote is one short line from the email, never the full email.
CREATE TABLE job_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  email_date INTEGER,
  subject TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT 'high',
  created_at INTEGER NOT NULL
);
CREATE INDEX job_events_job ON job_events(job_id, created_at);

ALTER TABLE documents ADD COLUMN gmail_draft_id TEXT;
