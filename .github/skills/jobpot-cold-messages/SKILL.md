---
name: jobpot-cold-messages
description: How Jobpot drafts cold outreach messages to recruiters, hiring managers, or employees on LinkedIn and Gmail. Use whenever the user clicks Draft message, or asks to write a LinkedIn note, connection request, InMail, cold email, referral request, or follow-up for a job.
---

# Cold messages

Draft only. Never send. Gmail drafts are saved to the user's Gmail Drafts folder with no recipient (the user adds one); LinkedIn drafts are shown with a Copy button on the Applied tab.

When the helper runs this unattended (the **Draft message** button), get the user's details with `jobpot profile` and the job with `jobpot describe <url>`, then reply with exactly these sections:

```
===LINKEDIN===
<connection note, 200 characters max>
===SUBJECT===
<email subject>
===EMAIL===
<email body, signed with the user's name and portfolio link>
===END===
```

The recipient is usually unknown, so use a neutral greeting ("Hi there,") rather than inventing a name.

Inputs: the job, the company, the recipient (name and role, if known), and the user's profile. Personalize with one specific, true detail about the recipient, team, or company.

## LinkedIn connection note

- Max **200 characters** (free accounts) or **300** (Premium). Default to 200.
- Structure: greeting + why them + the ask.

Example (placeholder data):
> Hi Alex, I just applied for the Product Designer role on your team. Your post on design systems resonated with me. Would love to connect and hear what the team is focused on.

## LinkedIn message or InMail (already connected)

50–125 words. Same structure as the email body below, without a subject line.

## Cold email

- **Subject:** short and specific, e.g. "Product Designer application: quick question" or "Referral question about the Product Designer role".
- **Body:** 50–125 words, 3–5 short sentences:
  1. Who the user is, in one line, tied to the role.
  2. The personal detail: why this person or team.
  3. One concrete, relevant result from the user's experience.
  4. A single easy ask, e.g. a 15-minute chat or a referral.
- Sign off with name and portfolio link. No attachments in the first message.

## Follow-ups

If no reply, suggest a follow-up after 3–5 business days, then one more after another 5–7 days. Max 3 messages total per person. Each follow-up should be shorter and add something new (e.g. a relevant project). Stop if the person asks not to be contacted.

## Rules

- Friendly and plain, not salesy or overly formal.
- Never claim a connection, referral, or fact that isn't true.
