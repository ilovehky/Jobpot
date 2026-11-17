# Copilot instructions for Jobpot

Product rules live in `spec.md`; read it before building features. When `spec.md` and code disagree, the code is authoritative and the spec should be updated.

## Commands

- `npm install`, then `npm run db:migrate:local` to create the local D1 database (stored in `.wrangler/`).
- `npm run dev` runs the React site and the Worker API together at http://localhost:5173 (Vite + Cloudflare Vite plugin).
- `npm run build` typechecks (`tsc -b` across `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.worker.json`) and builds.
- `npm run lint` runs oxlint.
- `npm run cf-typegen` regenerates `worker-configuration.d.ts` after any `wrangler.jsonc` change; never hand-edit it.
- Test the helper against a throwaway account with `HOME=/tmp/some-dir node helper/jobpot.mjs ...` so it doesn't overwrite the real `~/.jobpot` config; run `unschedule` afterwards.
- There is no automated test suite yet. Verify API changes with `curl` against the dev server (send an `Origin: http://localhost:5173` header on POST/PUT, or the CSRF check returns 403) and UI changes with `playwright-cli --browser msedge`.

## Architecture

- One Cloudflare Worker serves both the React SPA (Workers Static Assets, `not_found_handling: single-page-application`) and the API. Only `/api/*` runs the Worker (`run_worker_first`).
- `worker/index.ts` is a Hono app with `basePath('/api')`. `worker/auth.ts` holds password hashing and session tokens; `worker/validate.ts` holds input validation that throws `ValidationError` (mapped to a 400 with a user-facing message in `app.onError`).
- Data is in Cloudflare D1 only (no R2, by product decision). Schema changes go in a new numbered file in `migrations/`; never edit an applied migration.
- Resume files are stored as BLOBs in `resume_files`, separate from `resumes` metadata/text, to stay under D1's 2 MB row limit (uploads capped at 1.9 MB).
- Resume text is extracted in the browser (`src/lib/resumeText.ts`, pdf.js for PDF, mammoth for .docx) and sent with the file; the Worker never parses documents.
- The frontend has no router: `src/App.tsx` chooses between `AuthScreen`, `Onboarding` (until a resume, a job title, and a location exist), and `AppShell`, which switches the four tabs (Matches, Applied, Insights, Profile) by URL hash.
- AI work runs on the user's own computer through agent skills in `.github/skills/` (see `skills.md`), not in the Worker.
- `helper/jobpot.mjs` is the local helper (plain Node, no dependencies, not part of the Vite build). It pairs with an account via a one-time code (`/api/helper/pair` → bearer token in `~/.jobpot/config.json`), saves settings, installs a launchd job (`com.jobpot.daily`), and runs `copilot -p` unattended with `--allow-tool 'shell(jobpot:*)'` only. During a run, the agent reaches everything through `jobpot` subcommands (`profile`, `feed`, `browse` with an allowlist of safe `playwright-cli` commands, `result add`), and the helper uploads results to `/api/helper/runs` with usage parsed from Copilot's JSON output. Keep new agent capabilities behind `jobpot` subcommands rather than widening the allowed tools.
- Worker routes are split: `worker/index.ts` (auth, profile, resume), `worker/helper.ts` (pairing, helper bearer-auth routes, `/jobs`), shared session helpers in `worker/session.ts`. Helper routes use `Authorization: Bearer`, not cookies.
- Job tiers are not stored; `/api/jobs` derives them from `score` and the user's cutoffs in `settings`.

## Conventions

- Auth: PBKDF2-SHA256 at 100,000 iterations (the Workers runtime maximum), with the iteration count stored per user. Sessions use a random token in an HttpOnly, Secure, SameSite=Lax cookie (`jobpot_session`, 7 days). Only the SHA-256 hash of the token is stored in `sessions`.
- API responses default to `Cache-Control: no-store`.
- D1 allows 100 bound parameters per statement, so bulk inserts are chunked (see `JOB_ROWS_PER_INSERT`).
- API errors are JSON `{ "error": "<message shown to the user>" }`. Write messages in plain language that say how to fix the problem.
- Profile list fields (`target_titles`, `target_locations`, `work_types`) are JSON-encoded text columns.
- `compatibility_date` in `wrangler.jsonc` must not be newer than what the installed local runtime supports, or `npm run dev` fails.
- `@cloudflare/vite-plugin` is pinned to 1.x: 2.x requires `cloudflare.config.ts` and ignores `wrangler.jsonc`.
- Styling is plain CSS in `src/index.css` with design tokens (dawn/ink/marigold palette; Bricolage Grotesque for headings, Atkinson Hyperlegible Next for body; fonts self-hosted via Fontsource).
- Record every agent skill used or added in `skills.md`, including a change-log line.
- The repo is public: use made-up placeholder data in code, tests, and examples. Never commit real personal data or secrets (local secrets go in git-ignored `.dev.vars`).
