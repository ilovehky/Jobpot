---
name: jobpot-resume-cover-letter
description: How Jobpot writes a tailored resume and cover letter for a specific job. Use whenever the user clicks Generate tailored resume or Generate cover letter, or asks to tailor, rewrite, or improve a resume or cover letter for a job.
---

# Tailored resume and cover letter

Inputs: the user's original resume, portfolio link, saved profile info, and the job description. When the helper runs this unattended, get them with `jobpot profile` and `jobpot describe <url>`.

## Output format

Plain text that the website turns into a PDF. Use only these line types:

- `# Full Name` (first line)
- The line right after the name: contact details separated by ` · `
- `## Section` for section headings
- `### Role, Company` for a role or project heading; put location and dates on the next plain line
- `- ` for bullets
- Plain lines for paragraphs; a blank line separates paragraphs

No tables, columns, emoji, or Markdown links (write URLs as plain text). Bold and italics are ignored.

## Honesty first

Only use experience, skills, dates, and results that exist in the user's materials. Rephrase and reorder; never invent. If the job needs something the user lacks, leave it out and mention the gap in a note to the user, not in the document.

## Tailored resume

1. **Find the job's keywords:** skills, tools, job titles, and certifications in the description.
2. **Mirror honest matches:** use the job's exact wording where the user truly has the skill. Write both the acronym and the full term once, e.g. "User Experience (UX)".
3. **Reorder:** put the most relevant experience, bullets, and skills first.
4. **Rewrite bullets** as action + result + how: "Increased sign-up rate 18% by redesigning onboarding flow." Use numbers where the original has them; don't make numbers up.
5. **Trim:** 1 page for under 10 years of experience, otherwise up to 2.

Structure (single column, standard headings so hiring software can read it):

```
# Full Name
City, ST · email · phone · portfolio · linkedin
## Summary
2–3 lines aimed at this job.
## Experience
### Title, Company
City, ST · 2024 – 2026
- 3–5 bullets per role, newest role first
## Projects
(optional, if relevant)
## Skills
## Education
```

No tables, columns, icons, or images.

## Cover letter

200–350 words, under one page. Format:

```
# Full Name
City, ST · email · phone · portfolio
Month Day, Year

Dear Hiring Team,   (or the hiring manager's name if known)

Opening paragraph.

Body paragraph(s).

Closing paragraph.

Sincerely,
Full Name
```

1. **Opening:** the role, and one specific reason the user is interested in this company.
2. **Body (1–2 short paragraphs):** connect 2–3 of the job's top needs to concrete results from the user's experience. "You're looking for X; at Company I did Y, which led to Z."
3. **Close:** thank them and invite a conversation.

Use the company and hiring manager's name if known. Don't repeat the resume line by line.

## Rules

- Contact details come from the user's profile; never fill in placeholders with made-up data.
- Don't include demographic info, photos, or age-revealing dates (e.g. high school graduation year) unless the user asks.
