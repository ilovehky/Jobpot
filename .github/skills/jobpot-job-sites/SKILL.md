---
name: jobpot-job-sites
description: Which job sites Jobpot searches and how to search each one while signed out. Use whenever Jobpot searches for jobs, builds job search URLs, collects job listings, or the user asks which job sites are supported or wants to add or remove one.
---

# Job sites

Search while signed out. The user picks which sites are on (setting keys in brackets below); the defaults are LinkedIn and Indeed.

During an unattended run, use `jobpot browse <command>` for the browser (it wraps `playwright-cli` with a fixed session and only safe commands) and `jobpot feed <system> <company>` for company feeds.

## Search inputs

Target job titles and locations come from the user's profile. Run one search per title + location pair, newest first, and limit to jobs posted in the last 24 hours on daily runs.

## Job boards (browser, signed out)

| Site | Search URL | Useful parameters |
| --- | --- | --- |
| LinkedIn [`linkedin`] | `https://www.linkedin.com/jobs/search/?keywords={title}&location={location}` | `f_TPR=r86400` past 24 h · `f_WT=1` on-site, `2` remote, `3` hybrid |
| Indeed [`indeed`] | `https://www.indeed.com/jobs?q={title}&l={location}` | `fromage=1` past day · `sort=date` |
| Built In [`builtin`] | `https://builtin.com/jobs/hybrid/remote/office/design-ux?search={title}&city={city}&state={state}&country=USA&daysSinceUpdated=1` | Read job cards from `[data-id=job-card]`; open each job page for the description |
| Wellfound [`wellfound`] | `https://wellfound.com/role/l/{title-slug}/{city-slug}` | Listings often hide the company name; skip jobs without one |

Known behavior (Nov 2026): Indeed blocks signed-out automated browsers, and LinkedIn refuses rapid repeated requests. Read LinkedIn jobs one page at a time with pauses.

## Company career pages [`company-pages`] (public data feeds)

Many companies post jobs through hiring systems that publish public, read-only job feeds. These are officially allowed and more reliable than browsing. Check companies known for the user's field (for product design in the Bay Area, e.g. stripe, figma, databricks, anthropic, plaid on Greenhouse; openai, ramp, linear, harvey on Ashby).

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
