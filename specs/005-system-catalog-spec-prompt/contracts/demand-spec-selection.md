# Contract: Sistemas/Artefatos selecionados numa Demanda

Implements spec FR-007 through FR-013, FR-025 (User Story 3).

## `GET /api/v1/demands/:id/systems` (new)

- **200**: `{ available: System[], selected: System[] }` — `available` is the Client's
  associated active Systems (FR-007, reuses the `ClientSystem` lookup); `selected` is the
  demand's current `DemandSystem` set (may include Systems later deactivated — FR-025, kept
  visible in `selected` even if absent from `available`).
- Requires `DEMAND_READ`.

## `PUT /api/v1/demands/:id/systems` (new)

- **Body**: `{ systemIds: string[] }` — replace-set semantics, same soft-remove+upsert
  pattern as the Client×System endpoint.
- **422**: if any `systemId` is not associated (active `ClientSystem`) with the demand's
  `Client` (FR-013, SC-006) — enforced server-side regardless of what the frontend sent.
- **200**: updated selection.
- Requires `DEMAND_SYSTEM_WRITE`.

## `GET /api/v1/demands/:id/system-artifacts` (new)

- **200**: `{ available: SystemArtifact[], selected: SystemArtifact[] }` — `available` is
  the union of active `SystemArtifact`s across the demand's currently-selected Systems
  (FR-009); `selected` is the current `DemandSystemArtifact` set.
- Requires `DEMAND_READ`.

## `PUT /api/v1/demands/:id/system-artifacts` (new)

- **Body**: `{ systemArtifactIds: string[] }` — replace-set, same pattern.
- **422**: if any `systemArtifactId` belongs to a `System` not present in the demand's
  `DemandSystem` selection (FR-012, SC-006).
- **200**: updated selection.
- Requires `DEMAND_SYSTEM_WRITE`.

## Audit

Each selection change writes an `AuditLog` row (`action: "DEMAND_SYSTEM_SELECTED"|
"DEMAND_SYSTEM_ARTIFACT_SELECTED"`, `entityType: "demands"`, `entityId: demandId`) — FR-020.

## Frontend contract

`SpecificationWorkspace.tsx` gains a "Sistemas e Artefatos Envolvidos" section: multi-select
over `available` Systems (checkboxes), then per selected System a nested multi-select over
its `available` Artifacts — mirrors the doc's suggested UI (`Plano de Implementação` §15).
Selection persists immediately on change (no separate "save" step, consistent with how
`ProjectTechnologies`/`RolePermissions` already auto-save on toggle+button in this app) or
via an explicit "Salvar seleção" button — decided at task-writing time based on which reads
more naturally alongside the existing business/technical textareas.
