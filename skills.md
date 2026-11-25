# Jobpot — Skills Log

Skills are reusable instruction packs that teach the AI agent how to do a task.
This file records every skill used in this project.

## Development skills (installed locally)

Installed in `~/.copilot/skills/` on the developer's computer. Not stored in this repo.

| Skill | Source | License | Used for |
| --- | --- | --- | --- |
| frontend-design | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Apache 2.0 | Visual direction, typography, non-generic UI |
| skill-creator | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | Apache 2.0 | Writing Jobpot's own skills |
| ui-ux-pro-max | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | Palettes, font pairings, UX rules, design-token exports and previews (community skill) |
| web-design-guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | See repo | UI and accessibility reviews (fetches latest rules online) |
| react-best-practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | See repo | React performance and patterns |
| playwright-cli | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli/tree/main/skills/playwright-cli) | Apache 2.0 | Browser control for job search and Apply autofill. Needs `npm install -g @playwright/cli@latest` |
| cloudflare | [cloudflare/skills](https://github.com/cloudflare/skills/tree/main/skills/cloudflare) | Apache 2.0 | Choosing Cloudflare products |
| wrangler | [cloudflare/skills](https://github.com/cloudflare/skills/tree/main/skills/wrangler) | Apache 2.0 | Cloudflare command-line tool (local dev, deploy) |
| workers-best-practices | [cloudflare/skills](https://github.com/cloudflare/skills/tree/main/skills/workers-best-practices) | Apache 2.0 | Backend code on Cloudflare Workers |
| workers-development | [cloudflare/skills](https://github.com/cloudflare/skills/tree/main/skills/workers-development) | Apache 2.0 | Running and debugging the backend locally |
| cloudflare-app-bootstrap | [cloudflare/skills](https://github.com/cloudflare/skills/tree/main/skills/cloudflare-app-bootstrap) | Apache 2.0 | First-time app setup (database, secrets) |
| frameworks-on-cloudflare | [cloudflare/skills](https://github.com/cloudflare/skills/tree/main/skills/frameworks-on-cloudflare) | Apache 2.0 | Hosting the React site on Cloudflare |
| agents-sdk | [cloudflare/skills](https://github.com/cloudflare/skills/tree/main/skills/agents-sdk) | Apache 2.0 | Cloudflare Agents toolkit (if used) |

To install one: copy its folder (the one containing `SKILL.md`) into `~/.copilot/skills/`.

## Jobpot skills (stored in this repo)

Stored in `.github/skills/`, where GitHub Copilot finds them automatically.

| Skill | Purpose | Based on | Status |
| --- | --- | --- | --- |
| [jobpot](.github/skills/jobpot/SKILL.md) | Full daily flow, started with "jobpot!" | `spec.md` | Draft |
| [jobpot-job-sites](.github/skills/jobpot-job-sites/SKILL.md) | Which sites to search and how | LinkedIn/Indeed public search URLs; Greenhouse, Lever, Ashby public job feeds | Draft |
| [jobpot-fit-score](.github/skills/jobpot-fit-score/SKILL.md) | 0–100 score and tier for resume vs. job | Weighted hiring rubrics used by recruiters | Draft |
| [jobpot-resume-cover-letter](.github/skills/jobpot-resume-cover-letter/SKILL.md) | Tailored resume and cover letter | ATS-friendly resume and cover letter guides (2025–2026) | Tested |
| [jobpot-cold-messages](.github/skills/jobpot-cold-messages/SKILL.md) | LinkedIn and Gmail outreach drafts (Applied tab > Draft message) | LinkedIn note limits; recruiter outreach guides | Built |
| [jobpot-apply-autofill](.github/skills/jobpot-apply-autofill/SKILL.md) | Documents how the helper fills forms and saves answers (Tab 1); the work is done by `helper/autofill.js` | `spec.md` | Built |
| [jobpot-gmail-status](.github/skills/jobpot-gmail-status/SKILL.md) | Update application status from Gmail (Tab 2); rules in `helper/gmail.mjs`, AI only for unclear emails | Common hiring-system email patterns | Built |
| [jobpot-insights](.github/skills/jobpot-insights/SKILL.md) | Mismatch analysis and project ideas (Tab 3) | `spec.md` | Tested |
| [jobpot-profile](.github/skills/jobpot-profile/SKILL.md) | Profile from resume; onboarding; Tab 4 summary | `spec.md` | Draft |

"Draft" means written but not yet tested with real runs.

## Change log

- 2026-11-16: Installed all development skills listed above.
- 2026-11-16: Wrote first drafts of the 5 Jobpot skills.
- 2026-11-16: Wrote first drafts of the 4 extra Jobpot skills (autofill, Gmail status, insights, profile).
- 2026-11-16: Step 1 (website basics) used frontend-design, frameworks-on-cloudflare, wrangler, workers-best-practices, and playwright-cli.
- 2026-11-16: Step 2 (helper): updated jobpot, jobpot-job-sites, and jobpot-profile skills for the `jobpot` helper commands; used playwright-cli and workers-best-practices.
- 2026-11-16: Step 3: jobpot-fit-score gained experience and seniority caps; jobpot-job-sites gained the scan/search/describe commands and a verified company feed list (references/companies.md).
- 2026-11-17: Step 4: jobpot-resume-cover-letter gained the text format the PDF maker reads (tested live); jobpot-apply-autofill now documents the helper's code-based autofill. Used playwright-cli.
- 2026-11-17: Step 5: jobpot-gmail-status documents the helper's Gmail check (rules first, AI for unclear emails); jobpot-cold-messages gained the unattended output format.
- 2026-11-17: Step 6: jobpot-insights documents the unattended run and JSON output; tested live on placeholder data.
- 2026-11-17: Step 7: jobpot (setup consent), jobpot-fit-score (work authorization cap), jobpot-apply-autofill (self-identification), and jobpot-profile updated for self-identification and AI consent.
- 2026-11-18: Used jobpot to start an on-demand search with the helper's saved settings.
- 2026-11-19: Used ui-ux-pro-max, frontend-design, and playwright-cli for the standalone [design-token demo](design-system/jobpot-token-demo/preview.html); generated CSS/JSON tokens and an HTML preview, with desktop/mobile and keyboard checks in the integrated browser.
- 2026-11-19: Used ui-ux-pro-max and frontend-design to add an interactive switch and save-button example to the token demo, using its shared tokens and keeping all state in the current page.
- 2026-11-23: Used frontend-design, ui-ux-pro-max, and playwright-cli for the standalone [skill inspector](design-system/jobpot-skill-inspector/preview.html). Maps recorded skill use, generator output, runtime skill requests, and code-driven behavior without claiming contribution percentages or changing Jobpot's screens. The report contains no account data and makes no AI or network calls.
