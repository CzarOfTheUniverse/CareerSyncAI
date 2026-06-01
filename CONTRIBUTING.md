# Contributing

Thanks for your interest in improving CareerSync AI!

## Development setup

```bash
npm install
cp backend/.env.example backend/.env.local   # fill in values
npm run dev
```

Node `>=20.6` is required (`.nvmrc` pins the major version).

## Before opening a pull request

Run the full gate locally — CI runs the same:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Conventions

- TypeScript everywhere (`strict` mode). Avoid `any`; prefer precise types.
- Keep pure, testable logic in modules (e.g. `frontend/services/`,
  `backend/src/`) with accompanying `*.test.ts` Vitest specs.
- The Gmail→Gemini dedup pipeline and the proxy mapping are the load-bearing,
  non-obvious parts — add/adjust tests when you touch them. See `CLAUDE.md`.
- Never commit secrets. `backend/.env.local` and `secrets/` are git-ignored.

## Commit / PR

- Keep PRs focused and describe the user-facing effect.
- Ensure new code paths have tests and the gate is green.
