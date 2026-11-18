---
name: jobpot-apply-autofill
description: How Jobpot fills in a job application form for the user. Use whenever the user clicks Apply on a job, or asks Jobpot to open, fill in, or autofill an application form.
---

# Apply autofill

Apply is automated by the helper, not by an AI run, so it is instant and free. This skill describes what it does so changes stay consistent.

## How it works

1. The user clicks **Apply** on the Matches tab. The website sends the job link and a resume file (the tailored resume PDF if one is ready, otherwise the uploaded resume) to the local helper (`jobpot serve`).
2. The helper opens the link in the **Jobpot browser window**: a separate Edge or Chrome profile stored in `~/.jobpot/browser-profile`. The user signs in to job sites there once and stays signed in.
3. `helper/autofill.js` runs on each page of that window, only on known application sites (Greenhouse, Lever, Ashby, Workday, LinkedIn, and others) and the job's own site. On pages that look like an application form, it:
   - fills standard fields (name, email, phone, location, LinkedIn, portfolio) from the resume header and profile;
   - attaches the resume file to resume upload fields;
   - fills questions the user answered before when the question text matches;
   - outlines empty fields, focuses the first required one, and shows a "Next empty field" button.
4. Answers the user types are collected and saved to their profile (Profile > Saved answers) when they answer the website's "Applied?" prompt.

To change matching or add sites, edit `helper/autofill.js` and `APPLY_HOSTS` in `helper/jobpot.mjs`.

## Rules

- **Never click Submit**, Apply, or Send. The user always submits.
- Don't change answers the user typed.
- If a page has multiple steps, fill each step the same way and let the user click Next.
- Never save passwords, Social Security numbers, bank or card details, or answers longer than 300 characters.
- If the page breaks or blocks automation, the user fills it in by hand. The website's "Applied?" prompt still lets them record the outcome.
