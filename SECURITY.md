# Security Policy

## Reporting a vulnerability

Please report security issues privately — open a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories)
or email the maintainers rather than filing a public issue. We aim to acknowledge
reports within a few business days.

## Security model (self-host)

- **Vertex AI credentials** never reach the browser. The backend authenticates to
  Google with Application Default Credentials (a service-account key in
  production) and proxies requests. Use a least-privilege service account.
- **Access control.** Because a self-host URL is shared, the real boundary is
  Google access-token verification plus an operator allow-list
  (`ALLOWED_EMAILS` / `ALLOWED_HOSTED_DOMAIN`). The client-visible `PROXY_HEADER`
  is a secondary guard and is not, by itself, an authentication mechanism.
- **Secrets.** `backend/.env.local` and service-account keys are git-ignored and
  must never be committed. Rotate `PROXY_HEADER` and any leaked keys immediately.
- **Rate limiting** (100 requests / 15 min / IP) protects against runaway cost.
- **Logging.** Structured logs (pino) redact `authorization` and user-token
  headers; message contents of the AI WebSocket bridge are never logged.
- **Transport.** Terminate TLS at nginx or an upstream load balancer in
  production; the backend itself speaks HTTP on the internal network only.

## User data

The app requests `gmail.readonly`. Email content is parsed by Gemini and the
derived job records are stored **in the browser's localStorage only** — the
backend does not persist user email or job data. See [`PRIVACY.md`](PRIVACY.md).
