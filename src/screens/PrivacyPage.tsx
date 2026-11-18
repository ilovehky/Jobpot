const UPDATED = 'November 17, 2026'
const ISSUES_URL = 'https://github.com/ilovehky/Jobpot/issues'

export function PrivacyPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <a className="wordmark" href="#">
          Jobpot
        </a>
        <a className="link" href="#">
          Back to Jobpot
        </a>
      </header>
      <main className="page privacy">
        <h1>Privacy policy</h1>
        <p className="muted">Last updated {UPDATED}</p>

        <p className="lede">
          Jobpot helps you find jobs, apply, and follow up. It has two parts: this website, and a helper app that runs on
          your own computer. This page explains what each part keeps, what goes to outside services, and how to delete it.
        </p>

        <h2>What the website stores</h2>
        <p>Stored in Jobpot’s database on Cloudflare, linked to your account:</p>
        <ul>
          <li>Your name, email, and password (scrambled with PBKDF2, so no one can read it).</li>
          <li>Your resume file and its text, portfolio and LinkedIn links, target job titles, locations, and profile summary.</li>
          <li>Self-identification answers, if you choose to fill them in.</li>
          <li>Answers you typed into application forms, so Jobpot can fill them in next time. Passwords, Social Security numbers, and bank or card details are never saved.</li>
          <li>Jobs found for you, which ones you applied to, and their status.</li>
          <li>For each status update from Gmail: the email’s date, subject, and one short quote. Never the full email.</li>
          <li>Tailored resumes, cover letters, message drafts, insights, search settings, and how many AI requests were used each day.</li>
        </ul>

        <h2>What stays on your computer</h2>
        <ul>
          <li>Your Gmail sign-in, if you connect Gmail. It never leaves your computer.</li>
          <li>The Jobpot browser window’s profile, including any job-site logins you make in it.</li>
          <li>Files from each search and document run, deleted automatically after 14 days.</li>
        </ul>

        <h2>The AI</h2>
        <p>
          Jobpot uses your own GitHub Copilot account, running on your computer. Jobpot has no AI service of its own. What
          Copilot sees: your resume, profile, and job descriptions; and the text of an email when the rules can’t tell
          what it says. Your work authorization and sponsorship answers are shared only if you turn that on in Profile.
          Your gender, race, veteran, and disability answers and your saved form answers are never sent to the AI. GitHub
          handles what Copilot receives under its own privacy statement.
        </p>

        <h2>Gmail</h2>
        <p>
          If you connect Gmail, Jobpot asks Google for permission to read your email and create drafts. It only searches
          for emails that mention companies you applied to, and it never sends email. Drafts are saved for you to review
          and send yourself. Only the status, date, subject, and one short quote from each relevant email are uploaded.
          No person reads your email.
        </p>
        <p>
          Jobpot’s use and transfer of information received from Google APIs adheres to the{' '}
          <a className="link" href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Jobpot never sells Gmail data, uses it for ads, or uses it to train AI
          models.
        </p>

        <h2>Sharing</h2>
        <p>
          Jobpot doesn’t sell or share your data and has no ads, trackers, or analytics. It relies on: Cloudflare, which
          hosts the website and database; GitHub Copilot, through your own account; and Google, only if you connect Gmail.
          The job search browses job sites without signing in. The website uses one cookie to keep you logged in for 7
          days.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Edit your details, self-identification, and AI permission in Profile at any time.</li>
          <li>Delete any saved answer in Profile, and disconnect Gmail in the Applied tab.</li>
          <li>
            Delete your account in Profile. This deletes everything above from the database right away and clears Jobpot
            from your computer. Copies in Cloudflare’s automatic database backups are gone within 30 days.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions or requests: open an issue on{' '}
          <a className="link" href={ISSUES_URL}>
            Jobpot’s GitHub page
          </a>
          . Issues are public, so don’t include personal details there.
        </p>
        <p className="muted">If this policy changes, the date at the top will change too.</p>
      </main>
    </div>
  )
}
