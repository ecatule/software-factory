# Quickstart: Web Console — Administrative Screens

Validates spec.md's P1/P2/P5 tiers end-to-end through the console UI (not curl/Swagger),
building on `specs/001-ai-software-factory/quickstart.md`'s environment setup.

## Prerequisites

- Everything from 001's quickstart (Postgres/Redis/MinIO up, migrations + seed applied,
  `apps/api` and `apps/web` running).
- An OIDC identity provider configured in `.env` (`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`,
  `OIDC_CLIENT_SECRET`) — for local development without a real IdP, use a local OIDC-compliant
  stand-in (e.g. a dev-mode identity provider container) pointed at the seeded admin user's
  email.

## Scenario: sign in and operate the platform through the console (validates SC-001, SC-002, SC-003)

1. **Sign in**
   Open `apps/web`'s root URL. Confirm it redirects to `/login` (not the Dashboard) per
   FR-001. Complete the OIDC flow.
   - Expect: landing on the Dashboard within 2 clicks of the IdP's own consent/login screen
     (SC-001), with the signed-in user's identity visible in the nav shell.
2. **Dashboard**
   Confirm stage counts and the recent-demands list match what `GET /dashboard/summary`
   returns; click a recent demand and confirm it opens that demand's existing cockpit
   (spec 001 User Story 5) — not a duplicate view (FR-012).
3. **Create Client → Project → Demand entirely through the console**
   Clients screen → create a client. Projects screen → create a project under it, with a
   required test suite. Demands screen → create a demand under that project.
   - Expect: this whole sequence completable in well under the 3-minute SC-002 target, with
     no direct API calls.
   - Re-submit the same demand's external id → confirm the console shows the FR-028 rejection
     message clearly, not a raw HTTP error (FR-011).
4. **Navigate every screen from the nav shell**
   Confirm all 15 screens (Dashboard, Login, Clients, Projects, Demands, Workspaces,
   Artifacts, Specifications, Agents, Executions, Tests, Repositories, Git activity, Audit,
   Settings) are reachable from the persistent navigation without using the address bar
   (SC-003), and that a non-admin user does not see Settings in the nav at all (FR-003).
5. **Edit, version, and restore a Specification**
   Open a specification produced by 001's pipeline (or seed one), edit its content, save it,
   confirm a new version appears in history with the prior one intact, compare the two
   versions, then restore the prior one and confirm the version created in between is not
   lost (validates FR-017/018/019 against 001's FR-010/011 guarantee — SC-005).
6. **Settings: reject a secret-looking value**
   Open Settings, select a Provider, attempt to save a configuration value that looks like an
   API key (e.g. `sk-abcdef123456`). Confirm the console blocks the save and explains why
   (FR-031, SC-006).

## Expected outcome

Every action above happens through the console UI, calling only the endpoints documented in
`contracts/`, with the refresh token never readable from browser JavaScript (verify via
DevTools: the refresh cookie is `HttpOnly`) and every list screen paginating rather than
loading unbounded result sets (SC-007).
