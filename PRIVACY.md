# Privacy Policy

_This template is provided for self-host operators. Review and adapt it to your
deployment and jurisdiction before publishing it on your OAuth consent screen._

## What this application accesses

With your consent, CareerSync AI accesses:

- **Gmail (read-only, `gmail.readonly`)** — to find and read job-application
  emails sent to you.
- **Basic profile (`userinfo.email`, `userinfo.profile`)** — your name, email,
  and avatar, to personalize the app and enforce the operator's access allow-list.

## How data is used

- Matching email content is sent to Google's **Gemini** models (via Google Cloud
  Vertex AI, operated by the self-host operator) to extract structured
  job-application data (company, role, status, dates).
- The resulting job records, parsed emails, and any résumé you upload are stored
  **only in your browser's `localStorage`** on your device.

## What is NOT done

- The backend does **not** store your email, profile, job records, or résumé. It
  is a stateless proxy.
- Your data is **not** sold or shared with third parties beyond Google Cloud,
  which processes it to provide the AI features.

## Data retention & deletion

- Clearing the site's browser storage (or signing out) removes all locally stored
  data. You can revoke this app's access at any time at
  <https://myaccount.google.com/permissions>.

## Limited Use disclosure

Use of information received from Google APIs adheres to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements.

## Contact

Provide your contact details here (operator-specific).
