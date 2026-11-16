---
name: jobpot-apply-autofill
description: How Jobpot fills in a job application form for the user. Use whenever the user clicks Apply on a job, or asks Jobpot to open, fill in, or autofill an application form.
---

# Apply autofill

Open the job's apply page in the **Jobpot browser profile** (separate from the user's everyday browser; the user signs in to job sites there once). Use the browser tool (`playwright-cli`).

## Steps

1. **Open** the apply URL. If the site asks the user to sign in or create an account, pause and let the user do it. Never enter passwords.
2. **Read the form top to bottom.** For each field, note its label, type (text, dropdown, checkbox, file upload), and whether it's required.
3. **Fill from saved info** in the user's profile:
   - Standard fields: name, email, phone, location, links (portfolio, LinkedIn), work history, education.
   - Resume upload: use the tailored resume for this job if one exists, otherwise the original.
   - Questions answered before: reuse the saved answer only if the question means the same thing, e.g. "Are you legally authorized to work in the US?"
   - Demographic questions (race, gender, veteran, disability): use the user's saved answers only if they gave consent; otherwise leave them blank.
4. **Leave the rest empty**, including new free-text questions like "Why do you want to work here?". Don't guess.
5. **Focus the first empty field** (required ones first, then optional), top to bottom, so the user can fill them in one by one.
6. **Save new answers:** after the user fills in a field, save the question and answer to their profile so it can be filled automatically next time.

## Rules

- **Never click Submit**, Apply, or Send. The user always submits.
- Don't change answers the user typed.
- If a page has multiple steps, fill each step the same way and let the user click Next.
- If the page breaks or blocks automation, stop and tell the user. The website's "Applied?" prompt still lets them record the outcome.
