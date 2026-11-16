---
name: jobpot
description: Runs the full Jobpot daily job-hunting workflow. Use whenever the user says "jobpot!", asks to run, set up, or schedule their job search, or asks Jobpot to find jobs, score them, tailor a resume, or draft outreach.
---

# Jobpot workflow

Jobpot finds jobs that fit the user's profile, scores them, and prepares application material. The website shows results; this skill does the work on the user's own computer.

Product rules live in `spec.md` at the repo root. Read it if anything below is unclear; the spec wins on conflicts.

## First run ("jobpot!" for the first time)

1. Confirm the user has signed up on the Jobpot website and uploaded a resume, and that the profile is set up (see `jobpot-profile`).
2. Confirm consent for sending sensitive info (e.g. demographics) to the AI. Without consent, never include it in prompts.
3. Set up the daily schedule with the user:
   - Search time (e.g. 9:00 AM). The run starts 10 minutes earlier.
   - Max run time (default 10 min) and max tokens. If token counts aren't available, use max AI requests instead.
   - Max jobs per day (default 20).
   - Job sites to search (see `jobpot-job-sites`).
4. Remind the user that the computer must be on and awake at run time.

## Daily run

Stop as soon as the time limit or the token/request limit is reached, whichever comes first. Keep whatever results were found so far.

1. **Load the profile:** resume text, portfolio link, target job titles and locations (parsed from the resume), and saved preferences.
2. **Search:** follow `jobpot-job-sites`. Skip jobs already shown or already applied to.
3. **Score:** follow `jobpot-fit-score` for each job. Assign a tier with the user's cutoffs (defaults: Closest fit 75+, Reach 50–74, Far reach below 50).
4. **Keep the best:** sort by score and keep up to the daily max.
5. **Report usage:** record tokens (or requests) used and run time for the Tab 4 report.
6. **Hand results to the website** through the Jobpot helper. The helper's interface is not built yet; until then, output the results in the shape below.

### Result shape (draft)

For each job: title, company, location, work type (remote/hybrid/on-site), source site, job URL, apply URL, date posted, fit score, tier, and a one-line reason for the score.

## On-demand tasks

- **Tailored resume or cover letter:** follow `jobpot-resume-cover-letter`.
- **Cold message drafts:** follow `jobpot-cold-messages`.
- **Apply:** follow `jobpot-apply-autofill`.
- **Application status from Gmail (Tab 2):** follow `jobpot-gmail-status`.
- **Mismatch analysis and project ideas (Tab 3):** follow `jobpot-insights`.
- **Profile updates (Tab 4):** follow `jobpot-profile`.

## Rules

- Never submit an application, send a message, or send an email. The user does that.
- Search job sites signed out. Applying happens in the separate Jobpot browser profile, where the user is signed in.
- Never put real user data in this repo; it is public.
