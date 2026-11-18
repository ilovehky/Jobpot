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
- Daily AI-usage report: AI requests per day for the last 30 days, split by feature (Copilot reports requests, not tokens).
- Self-identification (optional), privacy policy link, and Delete account.
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
- **Stored per user:** resume, portfolio link, self-identification answers (e.g. race), and the fields saved from autofill.
- **Sensitive info:** with the user's consent (off by default), the AI may use work authorization and sponsorship. Gender, race, veteran, and disability answers never go to the AI.
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
- **Gmail:** a public app that reads email needs Google's security review before anyone outside a test list can use it. While the Google app is in Testing, only listed test users (up to 100) can connect, and Google expires their access after 7 days, so they reconnect weekly.
- **Schedule:** the user's computer must be on at search time; if it's asleep, the Mac runs the search when it wakes.
- **Helper on the deployed site:** browsers may ask the user once to let the Jobpot website reach the helper on their computer (Chrome's local network permission).
- **Live vs. local site:** the helper uploads to whichever site it was paired with (`--server`). Missed uploads retry on the next run.
- **Password checks on the free plan:** passwords use 100,000 rounds of PBKDF2 (the Workers maximum). Checked after deploying: sign-up and login work on the free plan (about 0.3 s each). Recheck if login errors appear as traffic grows.
- **Google review for Gmail:** Gmail read and draft access are Google's "restricted" permissions. Opening Gmail to anyone needs an owned domain (workers.dev can't be verified), a demo video, permission justifications, and a yearly third-party security assessment, because Jobpot uploads email subjects and quotes.

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
4. **Apply (Tab 1 actions):** autofill in the Jobpot browser profile, "Applied?" prompt, saved answers, tailored resume and cover letter PDFs. _Status: built and tested locally._
   - The helper now runs as a background service (`jobpot serve`, installed when pairing). The website calls it on this computer at `127.0.0.1:47821`; only the paired Jobpot website may call it.
   - Apply opens the job in the Jobpot browser window (separate Edge/Chrome profile in `~/.jobpot/browser-profile`). Autofill is plain code, not AI: free and instant. It only runs on known application sites and the job's own site.
   - Autofill uses the resume header (name, email, phone, city, links) and saved answers, attaches the tailored resume PDF if ready (otherwise the uploaded resume), outlines empty fields, and focuses the first required one.
   - Answers the user types are saved when they answer "Applied?" (Yes or No). Passwords, SSNs, bank/card details, and answers over 300 characters are never saved. Profile > Saved answers lists them, with Delete.
   - "Yes" moves the job to the Applied tab (basic list with "Move back to Matches"); "No" returns to the job.
   - Tailored resume and cover letter: Copilot writes them on the user's computer (about 1 AI request and 1–3 minutes each); the browser turns the text into a PDF on download.
5. **Applied jobs (Tab 2):** dashboard, Gmail connection and status updates, Draft message button. Needs a Google Cloud project. _Status: built and tested locally._
   - Gmail uses "Sign in with Google" (read + create drafts). The Jobpot owner's Google Cloud OAuth client (Desktop app) is stored as server secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; locally in git-ignored `.dev.vars`) and handed only to paired helpers, so users just click Connect Gmail.
   - The helper reads Gmail on the user's computer; the token stays in `~/.jobpot/gmail.json`. Only status, email date, subject, and one short quote are uploaded.
   - Status rules run first; only unclear emails go to Copilot (one batch). Statuses only move forward (Rejected can follow any); unsure updates wait for the user to confirm. No reply = Applied or In review for 30+ days.
   - Checked during each daily search and with **Check Gmail now**. Users can also set a status by hand.
   - **Draft message** writes a LinkedIn note (Copy) and an email saved to Gmail Drafts with no recipient.
6. **Insights (Tab 3):** rejection analysis and project ideas. _Status: built and tested locally._
   - Uses applications that were rejected or had no reply for 30+ days. Copilot reads the profile and job postings on the user's computer (about 1 AI request) and returns a summary, common gaps (with how many jobs asked for each), longer-term gaps, 2–4 project ideas (size and an example resume line for once it's done), and a reason per job.
   - Refreshes automatically after a daily search when new rejected or no-reply jobs appear, or with **Refresh insights**. When there's no clear pattern yet, it says so instead of guessing.
7. **Usage and privacy:** Tab 4 token report, sensitive-info consent, delete account, privacy policy page. _Status: built and tested locally._
   - Every AI use (search, resume, cover letter, message, insights, Gmail sorting) is logged with its date. Profile > AI usage shows today, the last 30 days as a bar chart, and totals by feature. Past usage was copied in from earlier runs.
   - Profile > Self-identification: gender, race or ethnicity, veteran, disability, work authorization, and sponsorship, each optional with "Prefer not to say". Autofill picks the matching option on application forms.
   - AI consent (a checkbox in the same section, off by default) lets the daily search use work authorization and sponsorship to rank lower the jobs the user can't take. Earlier consent from setup was reset because its meaning changed.
   - Delete account asks for the password, deletes every row for the account, then asks the helper to clear this computer (Gmail access, browser profile, run files, schedules). The helper only does this if its own connection was the one deleted. `jobpot forget` does the same by hand.
   - Privacy policy page at `#privacy`, linked from the login screen and the footer. Contact is through GitHub Issues.
8. **Launch:** go live publicly; request Google's review for Gmail access. _Status: live on the free workers.dev address; Gmail stays invite-only for now._
   - Cloudflare: D1 database `jobpot` (all migrations applied), Google keys stored as Worker secrets, deployed with `npm run deploy`.
   - The owner's local account (resume, profile, jobs, statuses, answers, documents, usage) was copied to the live database, and the helper was re-paired with the live site.
   - The website's "Connect your computer" command adds `--server <site address>` when the site isn't the local dev site.
   - Gmail: the Google app stays in Testing. Add people under Google Cloud Console > Google Auth Platform > Audience > Test users (up to 100); they reconnect weekly. Google's review is deferred until there's an owned domain (see Risks).

## 7. Open questions

_None right now._


## 8. More to spec (explore after all steps are implemented)
1. Add "like" button next to job, if liked, store the JD to the backend since jobs expire. Merge to "Applied" and rename the tab to "Job Dash"
2. For insights, go to job forums like Blind, Reddit, and Stack Overflow Jobs during rejected eval for more information, suggested projects and advice
3. For missing JD, search website like level.fyi and glassdoor for compensation and role details.
4. Take company rating from glassdoor and others into score calc
   
## 8. Random ideas (don't explore now)
1. Filter "Like" jobs and generate a separate scale you can switch bwt "most resume matching" or "most liked jobs"
2. Have a AI-generated 3 secs "a day at work" short vid at this company from sources like Blind, Reddit, and Stack Overflow Jobs. and more short vids showing how the company is diff from others, potential making money from these videos through ads or sponsorships.
3. You can get paid 30% more if you apply for this job
4. Search not just jobs, non profits and volunteering to find opportunities that match your skills and interests.
