# Contract: System / SystemArtifact catalog

Implements spec FR-001 through FR-003, FR-022 (User Story 1).

## `GET /api/v1/systems` (new)

- Query: `page`, `page_size` (capped at 100, platform-wide `paginate()` rule).
- **200**: `PaginatedResult<System>` — active and inactive by default (the UI filters or
  shows status inline, same pattern as `Technologies`/`Repositories`).
- Requires `SYSTEM_READ`.

## `POST /api/v1/systems` (new)

- **Body**: `{ name: string, description?: string }`.
- **201**: created `System` (`stAtivo: true`).
- Requires `SYSTEM_WRITE`.

## `PATCH /api/v1/systems/:id` (new)

- **Body**: `{ name?: string, description?: string, stAtivo?: boolean }` — activation/
  deactivation goes through this same endpoint (no separate status-only route, mirrors
  `PATCH /technologies/:id`).
- **200**: updated `System`.
- Requires `SYSTEM_WRITE`.

## `GET /api/v1/systems/:id/artifacts` (new)

- **200**: `SystemArtifact[]` belonging to the System (all statuses — frontend filters
  active-only where relevant, e.g. the SPEC selection screen calls this and filters
  client-side, or a `?active=true` query param is added at task-writing time if a
  server-side filter proves necessary for the SPEC-selection use case specifically).
- Requires `SYSTEM_ARTIFACT_READ`.

## `POST /api/v1/systems/:id/artifacts` (new)

- **Body**: `{ name: string, type: string, technology?: string, description?: string }`.
- **422**: if the target `System` has `stAtivo: false` (FR-003).
- **201**: created `SystemArtifact`.
- Requires `SYSTEM_ARTIFACT_WRITE`.

## `PATCH /api/v1/system-artifacts/:id` (new)

- **Body**: `{ name?: string, type?: string, technology?: string, description?: string, stAtivo?: boolean }`.
- **200**: updated `SystemArtifact`.
- Requires `SYSTEM_ARTIFACT_WRITE`.

## Audit

Every create/update (including activation/deactivation) on `System`/`SystemArtifact`
writes an `AuditLog` row (`action: "SYSTEM_CREATED"|"SYSTEM_UPDATED"|
"SYSTEM_ARTIFACT_CREATED"|"SYSTEM_ARTIFACT_UPDATED"`, `entityType: "systems"|
"system_artifacts"`) — FR-020.
