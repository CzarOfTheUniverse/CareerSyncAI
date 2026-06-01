# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is an npm workspaces monorepo. All commands are run from the repo root.

- `npm install` — installs both workspaces.
- `npm run dev` — runs frontend (Vite) and backend (nodemon) concurrently. Use this for normal development.
- `npm run dev-frontend` / `npm run dev-backend` — run a single side.
- `npm run build --prefix frontend` — production build of the React app.
- `npm start --prefix backend` — run backend with `node --env-file=.env.local`.

There is no test runner, lint, or typecheck script wired up. `tsc --noEmit -p frontend` is the only way to type-check the frontend.

## Required environment / auth

Backend reads `backend/.env.local` (loaded via `--env-file` and `dotenv`). Required:

- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` — used to construct Vertex endpoints and the WS BidiGenerateContent target. Server exits if missing.
- `PROXY_HEADER` — shared secret; every `/api-proxy` request must carry `x-app-proxy: <PROXY_HEADER>` or it is rejected with 403. The interceptor (`frontend/vertex-ai-proxy-interceptor.js`) is the only legitimate sender.
- Optional: `API_BACKEND_PORT` (default 5000), `API_BACKEND_HOST` (default 127.0.0.1), `API_PAYLOAD_MAX_SIZE` (default 7mb).

Vertex auth uses Google Application Default Credentials. Run `gcloud auth application-default login` once on the host before starting the backend — without ADC, `/api-proxy` returns 401.

The frontend's Gmail features require a user-supplied Google OAuth Client ID entered on the landing page (saved to localStorage). The Gmail API must be enabled on the matching Google Cloud project and the running origin added to "Authorized JavaScript origins".

## Architecture

Two interacting pieces:

**`backend/server.js`** — Express server that acts as a credentialed proxy in front of Vertex AI. It does NOT expose its own API surface to the user; instead it accepts a `{ originalUrl, method, headers, body }` envelope at `POST /api-proxy`, matches `originalUrl` against `API_CLIENT_MAP` (publisher-model `generateContent`/`predict`/`streamGenerateContent` and ReasoningEngine `query`/`streamQuery`), rewrites it to the corresponding `aiplatform.clients6.google.com` endpoint with an ADC bearer token + `X-Goog-User-Project`, and forwards the call. Streaming endpoints pipe chunks back with a per-client `transformFn` (the `streamGenerateContent` transform unwraps the JSON-array framing and re-emits SSE-style `data: {...}\n\n` frames). A separate WS upgrade handler at `/ws-proxy` authenticates and bridges a single allow-listed target — `wss://aiplatform.googleapis.com//ws/.../BidiGenerateContent` — to the regional `<location>-aiplatform.googleapis.com` endpoint, injecting the fully-qualified `projects/.../locations/.../<model>` path into the client's `setup` message.

**`frontend/`** — Vite + React + TypeScript single-page app (no router). `App.tsx` is the orchestrator: it owns auth state, jobs, emails, scan progress, and renders the landing page or the tabbed dashboard (`Dashboard`, `KanbanBoard`, `EmailList`, `AnalyticsView`, `AIAssistant`). State persists to `localStorage` under `career_sync_*` keys. The frontend talks to Vertex through the `@google/genai` SDK initialised with `vertexai: true`; `vertex-ai-proxy-interceptor.js` monkey-patches `window.fetch` and `window.WebSocket` to redirect every matching aiplatform.googleapis.com call to `/api-proxy` (or `/ws-proxy?target=…`), stamping the `x-app-proxy` header. Vite's dev server proxies both paths to the Node backend (`vite.config.ts`).

**Gmail → Gemini pipeline (the non-obvious part).** `triggerRealGmailScan` in `App.tsx` is the hot path; key invariants:

- Gmail query is constrained to `to:<recipient>` plus a configurable `lookbackDays` window. `recipient` defaults to the signed-in Google account email and is overridable via the "Inbox to:" input in the top bar (persisted as `career_sync_target_recipient`). When blank and no user email is available, the `to:` clause is omitted entirely rather than silently matching nothing.
- Message bodies are fetched with a bounded concurrency of 10. Emails are then batched (size 20) and sent to Gemini via `parseEmailsBatch` (one Gemini call per batch, batches run in parallel) — do not regress to per-email calls.
- Deduplication runs in four cascading steps and the order matters: (1) Gmail `threadId` match, (2) `company + titleSignature` exact match, (3) subset-title match when the same company already has exactly one candidate whose significant tokens are a subset/superset, (4) terminal-status fallback (Rejected/Offered) routes to the only existing job at that company. `titleSignature` strips requisition IDs, expands abbreviations (`tech→technical`, `sw→software`, …), and drops rank tokens (`senior`, `lead`, `i/ii/iii`, …). `mergeInto` upgrades status by `statusRank` (Applied < Interviewing < Offered=Rejected; Archived=0) and only then overwrites company/title with the later-stage values.
- Manually added jobs (no `emailSourceId`) are preserved across re-syncs; email-derived jobs are wiped at the start of each scan so re-runs rebuild via current dedup logic instead of stacking duplicates.
- `services/geminiService.ts` defines `PARSE_INSTRUCTIONS` (the system prompt) and the JSON `responseSchema`. The fallback parser intentionally returns `undefined` for company/jobTitle so the caller skips minting placeholder jobs; do not add fake defaults like "Unknown Company".

**Note on `vite.config.ts`.** It defines `process.env.API_KEY` as a literal placeholder string. This is intentional — the `@google/genai` SDK requires the field to exist, but actual auth happens via the backend proxy + ADC, not via that key.
