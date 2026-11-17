---
name: jobpot-fit-score
description: How Jobpot scores how well a user's resume and portfolio fit a job description (0–100) and assigns the Closest fit / Reach / Far reach tier. Use whenever Jobpot ranks, scores, compares, or explains the match between a user and a job, including mismatch analysis for rejected jobs.
---

# Fit score

Compare the user's resume and portfolio with one job description and return a 0–100 score, a tier, and a short reason.

## Step 1: Read the job

Pull out: required skills, preferred skills, years of experience, seniority, domain/industry, location and work type, education, and any hard requirements (e.g. license, clearance, work authorization).

## Step 2: Check deal-breakers

If the user clearly fails a hard requirement (e.g. the job requires on-site work in another country, or a certification they don't have), cap the score at 40 and name the reason.

## Step 3: Score each area (0–5), then weight

| Area | Weight | What a 5 looks like |
| --- | --- | --- |
| Required skills | 35% | Has nearly all of them, with real evidence |
| Experience level | 20% | Years and seniority match the posting |
| Preferred skills | 15% | Has most of the nice-to-haves |
| Domain / industry | 10% | Has worked in the same field |
| Location / work type | 10% | Matches the user's preferences |
| Education | 10% | Meets or exceeds what's asked |

Score = sum of (area score ÷ 5 × weight), giving 0–100.

Count a skill only when the resume or portfolio shows it was used (in a job, project, or result). Accept close synonyms, e.g. "Figma" for "UI design tools" or "JS" for "JavaScript".

## Step 4: Apply caps

Caps keep tiers honest. Use the user's Closest fit cutoff (default 75):

- **Experience gap:** if the job asks for 2 or more years more than the user's relevant experience, the score is at most one point below the Closest fit cutoff (74 by default), so it lands in Reach at best. Count full-time roles in the field; internships count as half.
- **Seniority title:** Staff, Principal, Lead, Manager, or Director roles when the user has under 6 years of experience: at most 20 points below the Closest fit cutoff (55 by default).
- **Deal-breakers** from Step 2 still cap at 40.

## Step 5: Tier

Use the user's cutoffs. Defaults: **Closest fit** 75+, **Reach** 50–74, **Far reach** below 50.

## Output

- Score (whole number) and tier.
- One-line reason under 140 characters, e.g. "Strong on Figma and design systems; asks 5+ years vs. your 2." Mention a cap when one applied.
- Matched and missing required skills (short lists), which Tab 3 uses for mismatch analysis.

## Rules

- Never use demographic info (race, gender, age, disability, veteran status, etc.) in scoring. It is only for filling in application forms.
- Score on evidence, not keyword counts. Repeating a word in the resume doesn't make it stronger.
- Be consistent: the same resume and job should get about the same score each time.
