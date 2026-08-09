# Contract: Settings (Providers)

Implements spec FR-029, FR-030, FR-031. Requires the `admin` role (spec Assumptions: coarse
role gating, consistent with 001).

## `GET /api/v1/providers`

- **200**: `Provider[]` — the fixed catalog (`key`, `kind`) seeded in 001
  (monday/github/chatgpt/claude/speckit/minio).

## `GET /api/v1/providers/:id/configurations`

- **Query params**: `project_id?` (omit for platform-default configurations only).
- **200**: paginated `ProviderConfiguration[]` (envelope per `data-model.md`).

## `POST /api/v1/providers/:id/configurations`

- **Body**: `{ projectId?, pipelineStage?, settings: Record<string, unknown> }`.
- **Validation (FR-031)**: every value in `settings` is checked against a secret-looking
  pattern (e.g. matches common API-key shapes, or the key name itself contains `key`,
  `secret`, `token`, `password`) — if any match, the request is rejected with **422** and a
  message explaining that secrets belong in environment/secret-store configuration, never in
  a `ProviderConfiguration` row (constitution: no credential in code or data). This is a
  best-effort guard, not a guarantee — real secret management remains an operational practice,
  not something this endpoint alone can fully enforce.
- **201**: the created/updated `ProviderConfiguration`.

## Frontend contract

The Settings screen lists providers, and for the selected provider shows existing
configurations grouped by project (platform-default configurations shown first). The
configuration form only exposes non-secret fields the source Provider adapter documents (e.g.
`pipelineStage` for LLM providers) — it does not render a generic free-text "value" field that
would invite pasting a secret, reducing (not eliminating) the odds of FR-031 ever triggering.
