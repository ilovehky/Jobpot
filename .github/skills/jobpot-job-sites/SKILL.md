---
name: jobpot-job-sites
description: Which job sites Jobpot searches and how to search each one while signed out. Use whenever Jobpot searches for jobs, builds job search URLs, collects job listings, or the user asks which job sites are supported or wants to add or remove one.
---

# Job sites

Search with the browser tool (`playwright-cli`) while signed out. The user picks which sites are on; the defaults are LinkedIn and Indeed.

## Search inputs

Target job titles and locations come from the user's profile. Run one search per title + location pair, newest first, and limit to jobs posted in the last 24 hours on daily runs.

## Job boards (browser, signed out)

| Site | Search URL | Useful parameters |
| --- | --- | --- |
| LinkedIn | `https://www.linkedin.com/jobs/search/?keywords={title}&location={location}` | `f_TPR=r86400` past 24 h · `f_WT=1` on-site, `2` remote, `3` hybrid |
| Indeed | `https://www.indeed.com/jobs?q={title}&l={location}` | `fromage=1` past day · `sort=date` |

Other boards the user can turn on: Glassdoor, ZipRecruiter, Wellfound (startups), Dice (tech), Built In, and Hacker News "Who is hiring?" (monthly thread).

## Company career pages (public data feeds)

Many companies post jobs through hiring systems that publish public, read-only job feeds. These are officially allowed and more reliable than browsing. Use them when the user follows specific companies.

| System | Feed URL |
| --- | --- |
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true` |
| Lever | `https://api.lever.co/v0/postings/{company}?mode=json` |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{company}` |

## What to collect per job

Title, company, location, work type, posted date, job URL, apply URL, and the full job description (needed for scoring).

## Rules

- LinkedIn and Indeed don't allow automated browsing. Keep volume low: pause a few seconds between pages, stop after the daily max, and never sign in while searching.
- If a site shows a CAPTCHA or blocks access, stop searching that site for this run and report it. Never try to bypass it.
- Remove duplicates (same company + title + location) across sites, keeping the one with the direct company apply link.
- Skip jobs already shown before or already applied to.
