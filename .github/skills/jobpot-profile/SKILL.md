---
name: jobpot-profile
description: How Jobpot builds and updates the user's profile from their resume, portfolio, and saved answers. Use whenever a user uploads or replaces a resume, during onboarding after sign-up, when Jobpot needs target job titles or locations, or when updating the Profile tab (Tab 4).
---

# Profile

The profile is what every other Jobpot skill reads. Build it from the resume, keep it updated, and let the user edit anything.

## Onboarding (right after sign-up)

1. Read the uploaded resume and fill in the profile fields below.
2. Suggest **target job titles** (from recent titles and the summary; 1–3 options) and **target locations** (current city, plus Remote if the resume suggests it).
3. Ask the user to confirm or edit the titles and locations first, before any job search. This is the first question after sign-up.

## Profile fields

- Contact: name, email, phone, city, portfolio link, LinkedIn link.
- Target job titles and target locations, including remote/hybrid/on-site preference.
- Experience: for each role, title, company, dates, and key results.
- Total years of experience and current seniority level.
- Skills, tools, and domains.
- Education and certifications.
- **Saved answers:** application questions and the user's answers (from `jobpot-apply-autofill`).
- **Demographics** (optional): only what the user enters themselves.

## Profile summary (shown in Tab 4)

3–4 plain sentences describing who the user is professionally: their strengths, the roles they target, and standout results. Regenerate it when the resume changes or important new info is saved.

## Updating

- When new info arrives (new saved answers, a new resume), merge it. Don't overwrite anything the user edited by hand; ask instead if there's a conflict.
- Show what changed since the last update.

## Rules

- Never guess demographics (race, gender, age, etc.) from the resume, name, or photo. Only use what the user enters.
- Only use facts found in the user's materials or entered by the user.
