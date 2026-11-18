-- Step 7: usage report, self-identification, and AI consent.

-- One row per AI use, so the daily report keeps history even when a document or insight is regenerated.
CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ai_requests INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX ai_usage_user_created ON ai_usage(user_id, created_at);

INSERT INTO ai_usage (id, user_id, kind, ai_requests, created_at)
  SELECT lower(hex(randomblob(16))), user_id, 'search', ai_requests, finished_at FROM runs WHERE ai_requests > 0;
INSERT INTO ai_usage (id, user_id, kind, ai_requests, created_at)
  SELECT lower(hex(randomblob(16))), user_id, kind, ai_requests, updated_at FROM documents WHERE ai_requests > 0;
INSERT INTO ai_usage (id, user_id, kind, ai_requests, created_at)
  SELECT lower(hex(randomblob(16))), user_id, 'insights', ai_requests, updated_at FROM insights WHERE ai_requests > 0;

-- Optional self-identification answers (JSON) used by autofill.
ALTER TABLE profiles ADD COLUMN self_id TEXT NOT NULL DEFAULT '{}';

-- Consent now lives with the profile and covers only work authorization and sponsorship.
-- It starts off for everyone because its meaning changed.
ALTER TABLE profiles ADD COLUMN ai_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings DROP COLUMN ai_consent;
