-- Step 4: applying, saved form answers, and tailored documents.

ALTER TABLE jobs ADD COLUMN applied_at INTEGER;

-- Answers the user typed into application forms, reused by autofill. question_key is the normalized question text.
CREATE TABLE answers (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, question_key)
);

-- Tailored resumes and cover letters, stored as text; the browser turns them into PDFs.
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  ai_requests INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, job_id, kind)
);
