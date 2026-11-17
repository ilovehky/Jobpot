# Jobpot! — Product Spec

## 1. Summary

A public website for job seekers, connected to an AI coding agent (GitHub Copilot first; Claude Code and Codex later), that runs a scheduled job-hunting workflow every day.

## 1a. How users get started

1. Sign up on the website.
2. Upload a resume. Jobpot reads target job titles and locations from it. This is the first step after sign-up.
3. Clone this repo and tell their AI agent **"jobpot!"** to start the workflow. The full workflow lives as a skill in this repo. The first "jobpot!" also sets up the daily schedule.
4. The agent runs on the user's own computer and uses the user's own AI subscription. A small Jobpot helper runs in the background there and connects the website to the agent.

## 2. Tabs

### Tab 1 — Job matches
- The agent opens a browser on the user's computer and searches job sites without signing in (LinkedIn, Indeed, others; configurable) and uses an LLM to list the jobs closest to my profile (default 20 per day, configurable).
- Jobs are grouped into 3 tiers by fit score: **Closest fit** (75+), **Reach** (50–74), **Far reach** (below 50). The user can edit these cutoffs.
- Each job has:
  - **Apply** (one click): the agent opens the apply page in a separate Jobpot browser profile (the user signs in to job sites there once and stays signed in), autofills my saved info, and moves focus top-to-bottom through any missing fields. Whatever I fill in gets saved for next time.
    - Meanwhile the website grays out and asks **"Applied?"** with Yes / No, and the user must choose one.
    - **Yes:** the job is recorded as applied (shows in Tab 2) and the user returns to Tab 1.
    - **No:** the user returns to the same job.
  - **Generate tailored resume** (PDF): the LLM writes a resume for that job.
  - **Generate cover letter** (PDF): next to the resume button.

### Tab 2 — Applied jobs
- A dashboard of jobs I've applied to.
- Connects to Gmail (read emails + create drafts) and updates each job's status from new emails.
- Each job has a **Draft message** button for cold messages, which are drafts only and sent by the user:
  - **Gmail:** saved to the user's Gmail Drafts folder.
  - **LinkedIn:** shown with a Copy button.

### Tab 3 — Insights
- Collects jobs that rejected me or have had no reply for more than a month.
- Explains why each one didn't match and suggests projects to add to my resume, based on requirements that come up often.

### Tab 4 — Profile
- Shows my personal info. The LLM generates it and keeps it updated as more info gets saved.
- Daily token-usage report (how much AI usage was spent each day). If Copilot doesn't report tokens, use the number of AI requests instead.
- The user can edit their info.

## 3. Website details

- **Frontend:** React.
- **Backend:** Cloudflare, free tier.
- **Storage:** Cloudflare D1 (database) only. No R2, so no payment card is needed.
  - Accounts, jobs, statuses, and usage.
  - Uploaded resume file (PDF or Word, max 1.9 MB to stay under D1's 2 MB row limit).
  - Tailored resumes and cover letters are saved as text and turned into PDFs on download.
- **Helper connection:**
  - The helper links to the user's account once with a pairing code (Profile > Connect your computer), then uploads daily search results.
  - The website talks directly to the helper on the same computer to open Apply (step 4). Chrome asks the user for permission once.
- **Accounts:** sign up and log in; stay logged in for 7 days.
- **Stored per user:** resume, portfolio link, demographic info (e.g. race), and the fields saved from autofill.
- **Sensitive info** may be sent to the AI, but only after the user gives consent.
- **Privacy:** a privacy policy page, plus an option to delete the account and all its data.
- **Device:** desktop first. Edge is the browser used during development.
- **Fit score:** compares my resume and portfolio against each job description.
- **Schedule:** I pick a time (e.g. 9:00 AM). The search starts 10 minutes early (8:50) and stops when either limit is reached first:
  - Max time (default 10 min, configurable)
  - Max tokens (configurable), or max requests if tokens aren't available

## 4. What this GitHub repo stores

- **Skills** (reusable agent instructions), based on examples found online:
  - Which job sites to search
  - How to calculate the fit score
  - Writing tailored resumes and cover letters
  - Writing cold messages on LinkedIn and Gmail
  - Apply autofill, Gmail status updates, mismatch insights, and profile building
- Full list of skills: `skills.md`.
- **The full Jobpot workflow** as a skill, started with "jobpot!".
- **Frontend and backend** code for the website.

## 5. Risks and things to verify

- **Site rules:** LinkedIn and Indeed don't allow automated browsing. Searching while signed out protects user accounts, but sites may block it or show fewer jobs.
- **Token report:** GitHub Copilot reports premium requests, not tokens, so limits and the Tab 4 report use requests.
- **Free tier:** Cloudflare's free limits may not cover a public product as it grows.
- **Gmail:** a public app that reads email needs Google's security review before anyone outside a test list can use it.
- **Schedule:** the user's computer must be on at search time; if it's asleep, the Mac runs the search when it wakes.
- **Local site:** until Jobpot is deployed, the local site must be running for results to upload. Missed uploads retry on the next run.
- **Password checks on the free plan:** passwords use 100,000 rounds of PBKDF2 (the Workers maximum). The free plan allows 10 ms of processing per request, so sign-up and login need checking once deployed.

## 6. Build plan

Each step is tested before the next one starts.

1. **Website basics:** sign up, log in (stay logged in 7 days), resume upload, confirm target job titles and locations, Tab 4 profile. Runs locally first, then on Cloudflare. _Status: built and tested locally; not yet deployed._
   - Resume text is read in the browser (no AI yet). Users type their job titles and locations. The AI profile summary comes in step 2.
2. **Helper and "jobpot!":** background helper on the user's computer, pairing code, first "jobpot!" sets up the daily schedule. _Status: built and tested locally (Mac only)._
   - The helper (`helper/jobpot.mjs`) saves settings, installs a Mac schedule that starts 10 minutes early, and runs GitHub Copilot unattended.
   - The unattended agent can only run the `jobpot` command: read the profile, read public company job feeds, use a signed-out browser with safe actions only (no file uploads), and save scored jobs.
   - Usage is counted in Copilot premium requests. Results that fail to upload are retried on the next run.
   - The AI profile summary (Tab 4) is written on the first run. The Matches tab lists uploaded jobs by tier; Apply and resume buttons come in step 4.
3. **Daily job search (Tab 1 list):** search sites, score, sort into tiers, stop at time/token limits. _Status: built and tested locally._
   - Helper search commands: `scan` (about 60 company job feeds in seconds), `search` (LinkedIn, Built In, Indeed; last 24 hours), and `describe` (full job description). All skip jobs already shown.
   - Scoring caps: jobs asking for 2+ more years than the user has can't be Closest fit; Staff/Principal/Lead roles are capped lower for users with under 6 years.
   - Matches shows the latest search by tier, with earlier matches below. Profile > Daily search edits jobs per day, time and AI limits, sites, and tier cutoffs. The search time is changed through the agent, because it updates the Mac schedule.
4. **Apply (Tab 1 actions):** autofill in the Jobpot browser profile, "Applied?" prompt, saved answers, tailored resume and cover letter PDFs.
5. **Applied jobs (Tab 2):** dashboard, Gmail connection and status updates, Draft message button. Needs a Google Cloud project.
6. **Insights (Tab 3):** rejection analysis and project ideas.
7. **Usage and privacy:** Tab 4 token report, sensitive-info consent, delete account, privacy policy page.
8. **Launch:** go live publicly; request Google's review for Gmail access.

## 7. Open questions

_None right now._
