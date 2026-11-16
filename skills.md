# Jobpot — Skills Log

Skills are reusable instruction packs that teach the AI agent how to do a task.
This file records every skill used in this project.

## Development skills (installed locally)

Installed in `~/.copilot/skills/` on the developer's computer. Not stored in this repo.

| Skill | Source | License | Used for |
| --- | --- | --- | --- |
| frontend-design | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Apache 2.0 | Visual direction, typography, non-generic UI |
| skill-creator | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | Apache 2.0 | Writing Jobpot's own skills |
| ui-ux-pro-max | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | Palettes, font pairings, UX rules (community skill) |
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
| [jobpot-resume-cover-letter](.github/skills/jobpot-resume-cover-letter/SKILL.md) | Tailored resume and cover letter | ATS-friendly resume and cover letter guides (2025–2026) | Draft |
| [jobpot-cold-messages](.github/skills/jobpot-cold-messages/SKILL.md) | LinkedIn and Gmail outreach drafts | LinkedIn note limits; recruiter outreach guides | Draft |
| [jobpot-apply-autofill](.github/skills/jobpot-apply-autofill/SKILL.md) | Fill application forms; save new answers (Tab 1) | `spec.md` | Draft |
| [jobpot-gmail-status](.github/skills/jobpot-gmail-status/SKILL.md) | Update application status from Gmail (Tab 2) | Common hiring-system email patterns | Draft |
| [jobpot-insights](.github/skills/jobpot-insights/SKILL.md) | Mismatch analysis and project ideas (Tab 3) | `spec.md` | Draft |
| [jobpot-profile](.github/skills/jobpot-profile/SKILL.md) | Profile from resume; onboarding; Tab 4 summary | `spec.md` | Draft |

"Draft" means written but not yet tested with real runs.

## Change log

- 2026-11-16: Installed all development skills listed above.
- 2026-11-16: Wrote first drafts of the 5 Jobpot skills.
- 2026-11-16: Wrote first drafts of the 4 extra Jobpot skills (autofill, Gmail status, insights, profile).
