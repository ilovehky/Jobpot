# Jobpot

A website for job seekers that works with an AI agent (GitHub Copilot first) to run a daily job search. See [spec.md](spec.md) for the product spec and [skills.md](skills.md) for the agent skills.

## Run it locally

Needs Node.js 20 or newer.

```sh
npm install
npm run db:migrate:local   # set up the local database (first time, and after new migrations)
npm run dev                # open http://localhost:5173
```

## Connect your computer (daily search)

Mac only for now. Needs the GitHub Copilot CLI (`copilot`, signed in) and `playwright-cli`.

1. In Jobpot, open **Profile > Connect your computer** and run the command it shows: `node helper/jobpot.mjs pair <code>`.
2. Say "jobpot!" to your AI agent in this folder, or run `node helper/jobpot.mjs settings --time 09:00` yourself. This installs a Mac schedule that starts the search 10 minutes early.
3. Run a search now with `node helper/jobpot.mjs run --minutes 2`. See all commands with `node helper/jobpot.mjs help`.

The helper keeps its connection and run files in `~/.jobpot/` (private to your user). Remove the schedule with `node helper/jobpot.mjs unschedule`.

## Other commands

| Command | What it does |
| --- | --- |
| `npm run build` | Typecheck and build the site |
| `npm run lint` | Check code style |
| `npm run deploy` | Build and publish to Cloudflare (needs `npx wrangler login`) |
| `npm run db:migrate:remote` | Apply database migrations to the live Cloudflare database |
| `npm run cf-typegen` | Regenerate Cloudflare types after editing `wrangler.jsonc` |
