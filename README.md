# CareerSync AI — Smart Job Tracker

CareerSync AI scans your Gmail for job-application correspondence (confirmations,
recruiter outreach, interview invites, offers, rejections) and uses Google's
Gemini models — via a credentialed Vertex AI proxy — to extract, deduplicate, and
track every application in a dashboard, Kanban board, analytics view, AI career
coach, and résumé reviewer.

This repository is a **self-hostable** deployment: an operator configures it once
(GCP project, a service account, and one OAuth client ID), runs `docker compose up`,
and shares the URL. End users just **Sign in with Google** — no per-user setup.

## Architecture

- **`frontend/`** — Vite + React + TypeScript SPA. Talks to Vertex AI through the
  `@google/genai` SDK; `vertex-ai-proxy-interceptor.js` redirects every matching
  `aiplatform.googleapis.com` call to the backend. It fetches runtime settings
  (OAuth client ID, model) from the backend's `GET /config`.
- **`backend/`** — Node + TypeScript (`backend/src/`). An Express server that
  proxies Vertex AI `generateContent`/`predict`/streaming and the
  BidiGenerateContent WebSocket, authenticating to Google with Application Default
  Credentials (a service account in production). It also serves `/config`,
  `/healthz`, `/readyz`, and enforces an end-user allow-list.
- **nginx** (in the container image) serves the built SPA and reverse-proxies
  `/api-proxy`, `/ws-proxy`, and `/config` to the backend.

## Quick start (Docker, recommended)

Prerequisites: Docker, a Google Cloud project with the **Vertex AI API** enabled,
a **service-account key** with Vertex AI access, and an **OAuth 2.0 Client ID**
(Web application) whose Authorized JavaScript origin matches your deployment URL.

```bash
cp backend/.env.example backend/.env.local
# edit backend/.env.local — set GOOGLE_CLOUD_PROJECT, GOOGLE_OAUTH_CLIENT_ID,
# PROXY_HEADER, ALLOWED_EMAILS (or ALLOWED_HOSTED_DOMAIN), and
# GOOGLE_APPLICATION_CREDENTIALS=/secrets/service-account.json

mkdir -p secrets
cp /path/to/your/service-account.json secrets/service-account.json

docker compose up --build
```

Then open <http://localhost:8080>.

## Local development

Requires Node `>=20.6` (see `.nvmrc`).

```bash
npm install
gcloud auth application-default login   # or set GOOGLE_APPLICATION_CREDENTIALS
cp backend/.env.example backend/.env.local   # fill in values
npm run dev                              # frontend (Vite) + backend (tsx) together
```

Vite proxies `/api-proxy`, `/ws-proxy`, and `/config` to the backend on port 5000.

## Scripts (run from the repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Run frontend + backend together |
| `npm run build` | Build backend (tsc) then frontend (vite) |
| `npm test` | Run the Vitest suites in both workspaces |
| `npm run typecheck` | `tsc --noEmit` for both workspaces |
| `npm run lint` | ESLint across the repo |
| `npm run format` | Prettier write |

## Configuration

All backend configuration is via environment variables — see
[`backend/.env.example`](backend/.env.example) for the full, documented list.
The browser-relevant subset (OAuth client ID, Gemini model, default look-back,
whether auth is enforced) is exposed at `GET /config`.

## OAuth & Gmail scopes (important)

The app reads Gmail using the **`gmail.readonly`** scope, which Google classes as
a **restricted scope**:

- In your OAuth consent screen's **testing** mode you may authorize **up to 100
  users with no Google verification** — the right fit for most self-hosters.
- For public/external use beyond that, Google requires consent-screen
  verification plus a **CASA security assessment**. See [`PRIVACY.md`](PRIVACY.md)
  and Google's [OAuth verification docs](https://support.google.com/cloud/answer/13463073).

Keep the requested scopes minimal (`gmail.readonly`, `userinfo.email`,
`userinfo.profile`).

## Security

The shared URL is gated by **Google access-token verification + an operator
allow-list** (`ALLOWED_EMAILS` / `ALLOWED_HOSTED_DOMAIN`); the `PROXY_HEADER` is a
secondary guard only. Report vulnerabilities per [`SECURITY.md`](SECURITY.md).

## License

[Apache-2.0](LICENSE).
