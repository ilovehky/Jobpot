# Copilot instructions for Jobpot

Product rules live in `spec.md`; read it before building features. When `spec.md` and code disagree, the code is authoritative and the spec should be updated.

## Commands

- `npm install`, then `npm run db:migrate:local` to create the local D1 database (stored in `.wrangler/`).
- `npm run dev` runs the React site and the Worker API together at http://localhost:5173 (Vite + Cloudflare Vite plugin).
- `npm run build` typechecks (`tsc -b` across `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.worker.json`) and builds.
- `npm run lint` runs oxlint.
- `npm run cf-typegen` regenerates `worker-configuration.d.ts` after any `wrangler.jsonc` change; never hand-edit it.
- Test the helper against a throwaway account with `JOBPOT_HOME=/tmp/some-dir JOBPOT_NO_LAUNCHD=1 node helper/jobpot.mjs ...` (see Architecture); never run `unschedule` after a test, because it removes the real daily schedule.
- There is no automated test suite yet. Verify API changes with `curl` against the dev server (send an `Origin: http://localhost:5173` header on POST/PUT, or the CSRF check returns 403) and UI changes with `playwright-cli --browser msedge`.

## Architecture

- One Cloudflare Worker serves both the React SPA (Workers Static Assets, `not_found_handling: single-page-application`) and the API. Only `/api/*` runs the Worker (`run_worker_first`).
- `worker/index.ts` is a Hono app with `basePath('/api')`. `worker/auth.ts` holds password hashing and session tokens; `worker/validate.ts` holds input validation that throws `ValidationError` (mapped to a 400 with a user-facing message in `app.onError`).
- Data is in Cloudflare D1 only (no R2, by product decision). Schema changes go in a new numbered file in `migrations/`; never edit an applied migration.
- Resume files are stored as BLOBs in `resume_files`, separate from `resumes` metadata/text, to stay under D1's 2 MB row limit (uploads capped at 1.9 MB).
- Resume text is extracted in the browser (`src/lib/resumeText.ts`, pdf.js for PDF, mammoth for .docx) and sent with the file; the Worker never parses documents.
- The frontend has no router: `src/App.tsx` chooses between `AuthScreen`, `Onboarding` (until a resume, a job title, and a location exist), and `AppShell`, which switches the four tabs (Matches, Applied, Insights, Profile) by URL hash.
- AI work runs on the user's own computer through agent skills in `.github/skills/` (see `skills.md`), not in the Worker.
- `helper/jobpot.mjs` is the local helper (plain Node, no dependencies, not part of the Vite build). It pairs with an account via a one-time code (`/api/helper/pair` → bearer token in `~/.jobpot/config.json`), saves settings, installs a launchd job (`com.jobpot.daily`), and runs `copilot -p` unattended with `--allow-tool 'shell(jobpot:*)'` only. During a run, the agent reaches everything through `jobpot` subcommands (`profile`, `scan` for company feeds, `search` for job sites, `describe`, `browse` with an allowlist of safe `playwright-cli` commands, `result add`), and the helper uploads results to `/api/helper/runs` with usage parsed from Copilot's JSON output. Keep new agent capabilities behind `jobpot` subcommands rather than widening the allowed tools.
- `jobpot serve` (launchd `com.jobpot.helper`, KeepAlive) is a local HTTP service on `127.0.0.1:47821` that the website calls from the browser (`src/lib/helperClient.ts`). It only answers requests whose `Origin` is the paired server and requires JSON bodies. `/apply` opens the job in a headed playwright-cli session (`jobpot-apply`) with a persistent profile and installs `helper/autofill.js` as an init script; data reaches pages through `exposeBinding` (`__jobpotData`, `__jobpotResume`), and typed answers are kept on the browser context (`ctx.__jobpotAnswers`) until `/answers` uploads them. `/documents/:id/generate` runs Copilot (queued, one at a time) and parses the reply between `===BEGIN===`/`===END===`. `/forget` (called after account deletion) clears `~/.jobpot`, Gmail access, and both launchd jobs, but only after confirming its own helper token no longer works, so deleting a different account on the same computer can't wipe it.
- `run-code` snippets run in an isolated sandbox per call (no `require`, globals don't persist); store shared state on the Playwright context object. Pass large data via `--filename`, not the command line.
- Set `JOBPOT_HOME=/tmp/some-dir` and `JOBPOT_NO_LAUNCHD=1` (plus `JOBPOT_PORT` for `serve`) when testing the helper against a test account. Use `JOBPOT_HOME`, not `HOME`, so Copilot stays signed in. `JOBPOT_NO_LAUNCHD=1` keeps the user's real launchd jobs from being replaced.
- Tailored documents are stored as text in `documents`; `src/lib/documentPdf.ts` (pdf-lib, standard Helvetica) renders the `#`/`##`/`###`/`-` line format defined in the jobpot-resume-cover-letter skill. Keep the two in sync.
- Copilot's `--max-ai-credits` must be at least 30.
- `runCopilot` sets `COPILOT_HOME` to a private folder in the run directory (copying `config.json`/`settings.json` from `~/.copilot`; sign-in comes from the Keychain) and deletes it afterwards, so unattended runs never appear in the user's Copilot session list. `jobpot clean-sessions` removes Jobpot sessions created before this.
- Sleep: runs are wrapped in `caffeinate -i -s`. The daily run stops itself when the wall clock jumps over 60 s (the Mac slept), records `~/.jobpot/last-run.json`, and `jobpot serve` starts a catch-up run (`run --catchup`, at most 2 a day) after the scheduled time once the user is active (`HIDIdleTime`). `~/.jobpot/run.lock` keeps runs from overlapping.
- The agent can run several `jobpot` commands at once; browser reads (`search`, `describe`) share one playwright-cli session, so they go through `withBrowserLock` (a lock folder in the run directory). Keep new browser commands behind it.
- Insights (`worker/insights.ts`, `generateInsights` in the helper) store one JSON analysis per user plus the job ids it covered; the helper only re-runs when the eligible job set changed (unless forced).
- Gmail lives in `helper/gmail.mjs` (desktop OAuth with PKCE and a loopback redirect; refresh token in `~/.jobpot/gmail.json`). The helper gets the OAuth client from `GET /api/helper/gmail/google-client`, backed by Worker secrets `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (`.dev.vars` locally; restart `npm run dev` after editing it). Never commit these values.
- Status updates go through `POST /api/helper/gmail/statuses` (`worker/status.ts`), which enforces forward-only status changes; low-confidence updates only set `needs_review`. Keep the rule patterns in `helper/gmail.mjs` in line with the jobpot-gmail-status skill.
- Outreach drafts are `documents` with kind `outreach`; content uses `===LINKEDIN===`/`===SUBJECT===`/`===EMAIL===` sections parsed by both the helper and `AppliedTab.tsx`.
- Worker routes are split: `worker/index.ts` (auth, profile, resume), `worker/helper.ts` (pairing, helper bearer-auth routes, `/jobs`), `worker/apply.ts` (applied flag, saved answers, documents; helper routes under `/api/helper/apply`), `worker/status.ts` (Applied dashboard, statuses, Gmail client; helper routes under `/api/helper/gmail`), `worker/insights.ts` (Insights; helper routes under `/api/helper/insights`), `worker/privacy.ts` (usage, self-identification, account deletion; helper route `/api/helper/usage`), shared session helpers in `worker/session.ts`. Helper routes use `Authorization: Bearer`, not cookies.
- Job URLs go through `canonicalUrl` in the helper (LinkedIn job links have several forms) so "already seen" checks match.
- The search time can only change through the helper (`jobpot settings --time`), because it rewrites the launchd schedule; `PUT /api/settings` from the website edits everything else.
- Every AI use is logged in `ai_usage` (kind, request count, time) for the Tab 4 usage report: runs, documents, and insights log it server-side via `usageStatement` in `worker/privacy.ts`; Gmail sorting posts to `/api/helper/usage`. New AI features must log usage too.
- `worker/privacy.ts` also holds self-identification (`profiles.self_id` JSON, `profiles.ai_consent`) and account deletion. Autofill gets all self-ID answers; `/api/helper/profile` (what the AI reads) includes only `workAuthorization`, and only with consent. Never send gender, race, veteran, or disability answers to the AI. Account deletion removes rows from every user table explicitly; add new tables to `USER_TABLES`.
- The privacy policy is `src/screens/PrivacyPage.tsx` (`#privacy`, shown signed in or out). Update it when Jobpot starts storing or sharing something new.
- Job tiers are not stored; `/api/jobs` derives them from `score` and the user's cutoffs in `settings`.

## Conventions

- Auth: PBKDF2-SHA256 at 100,000 iterations (the Workers runtime maximum), with the iteration count stored per user. Sessions use a random token in an HttpOnly, Secure, SameSite=Lax cookie (`jobpot_session`, 7 days). Only the SHA-256 hash of the token is stored in `sessions`.
- API responses default to `Cache-Control: no-store`.
- D1 allows 100 bound parameters per statement, so bulk inserts are chunked (see `JOB_ROWS_PER_INSERT`).
- API errors are JSON `{ "error": "<message shown to the user>" }`. Write messages in plain language that say how to fix the problem.
- Profile list fields (`target_titles`, `target_locations`, `work_types`) are JSON-encoded text columns.
- The local D1 file in `.wrangler/state/v3/d1/` is named from the `database_id`, so changing that id makes `npm run dev` start on an empty local database.
- `compatibility_date` in `wrangler.jsonc` must not be newer than what the installed local runtime supports, or `npm run dev` fails.
- `@cloudflare/vite-plugin` is pinned to 1.x: 2.x requires `cloudflare.config.ts` and ignores `wrangler.jsonc`.
- Styling is plain CSS in `src/index.css` with design tokens (dawn/ink/marigold palette; Bricolage Grotesque for headings, Atkinson Hyperlegible Next for body; fonts self-hosted via Fontsource).
- Record every agent skill used or added in `skills.md`, including a change-log line.
- The repo is public: use made-up placeholder data in code, tests, and examples. Never commit real personal data or secrets (local secrets go in git-ignored `.dev.vars`).
