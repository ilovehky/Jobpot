---
name: jobpot-gmail-status
description: How Jobpot reads the user's Gmail to update the status of jobs they applied to. Use whenever Jobpot checks email for application updates, refreshes the Applied jobs dashboard (Tab 2), or the user asks whether a company has replied.
---

# Gmail status updates

Gmail access is read-only plus creating drafts. Never send, delete, archive, or label emails.

## Find relevant emails

Only look at emails received since the oldest applied job's date. Search for:

- Emails from hiring systems, e.g. `greenhouse.io`, `lever.co`, `ashbyhq.com`, `myworkday.com`, `myworkdayjobs.com`, `smartrecruiters.com`, `icims.com`, `jobvite.com`.
- Emails mentioning an applied company's name together with words like application, interview, candidacy, or position.

Read only emails that match an applied job. Ignore everything else in the inbox.

## Match email to job

Match on company name first, then job title. If one company has several applied jobs and the email doesn't say which, mark all of them as "Needs review" rather than guessing.

## Statuses

| Status | Typical email signals |
| --- | --- |
| Applied | "We received your application", "Thank you for applying" |
| In review | "Your application is under review", "next steps soon" |
| Assessment | Take-home task, coding test, or questionnaire link |
| Interview | Scheduling link, interview invite, "speak with you" |
| Offer | "Pleased to offer", offer letter |
| Rejected | "Not moving forward", "decided to pursue other candidates", "position has been filled" |
| No reply | No new email 30+ days after applying (set by Jobpot, not an email) |

A status only moves forward, except Rejected, which can follow any status. If an email is unclear, keep the current status and flag it as "Needs review".

## Output per update

Job, new status, email date, the sentence that shows the status (one line), and confidence (high / low). Low-confidence updates are shown to the user to confirm.

## Rules

- Don't store full email content; keep only the status, date, and the one-line quote.
- Rejected and No reply jobs feed Tab 3 (see `jobpot-insights`).
