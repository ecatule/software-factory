# Phase 1 Data Model: Advanced Console & Governance

No new tables. Every change is either a nullable column extension on an existing model, or
reuse of an already-modeled but under-utilized entity (`Permission`/`RolePermission`).

## Extended: `Project`

| Field | Type | Notes |
|---|---|---|
| productionBranch | String? | e.g. `"main"` |
| homologationBranch | String? | e.g. `"staging"` |
| homologationEnvironment | String? | Free text/URL (research.md §11 — not an active integration) |
| productionEnvironment | String? | Free text/URL |

## Extended: `Repository`

| Field | Type | Notes |
|---|---|---|
| productionBranch | String? | Overrides the project-level value for this specific repository when set |
| homologationBranch | String? | Overrides the project-level value for this specific repository when set |

## Reused: `Permission` (no schema change)

Already exists since 001 with `name` (unique), `description`. New rows seeded for the
FR-004 catalog: `DEMAND_READ`, `DEMAND_WRITE`, `SPECIFICATION_WRITE`,
`SPECIFICATION_APPROVE`, `AGENT_EXECUTE`, `GIT_WRITE`, `PR_CREATE`, `AUDIT_READ` — alongside
the pre-existing `platform:admin` row (left untouched).

## Extended: `RolePermission`

Already exists since 001 as the `Role`↔`Permission` join. New rows associate every FR-004
permission with the `admin` role (FR-008); other roles (if any exist beyond the seeded
`admin`) start with no new permissions until an administrator assigns them (User Story 2
Acceptance Scenario 1).

**Correction found during `/speckit.analyze` (finding G1)**: gains a `stAtivo Boolean
@default(true)` column. Physical delete is blocked platform-wide by `softDeleteGuardExtension`
even for join tables with no other audit columns — this is the identical issue already found
and fixed for `ProjectTechnology` in feature 003 (`setTechnologies()`'s soft-remove + upsert
pattern). `PUT /roles/:id/permissions` (replacing a role's full permission set) needs the
same treatment: revoked permissions get `stAtivo: false` instead of a physical delete;
`GET /roles/:id/permissions` and permission checks filter on `stAtivo: true`.

## Reused: `AuditLog` (no schema change, new write pattern)

`WorkflowsService.transition()`/`advanceToNextStage()` now explicitly create a row: `action:
"STAGE_TRANSITION"`, `entityType: "demands"`, `entityId: <demandId>`, `before: {status:
<oldStatus>}`, `after: {status: <newStatus>}`, `occurredAt` defaulting to now — the same
shape the global `AuditInterceptor` already produces for HTTP-triggered writes, just written
explicitly so worker-triggered transitions (research.md §6) are captured too.

## JWT payload (not persisted, but a shared contract)

`JwtPayload` (`apps/api/src/modules/identity/auth/jwt.strategy.ts`) gains `permissions:
string[]`, computed at token-issue time in `AuthService.issueTokensForVerifiedIdentity()` by
flattening the authenticated user's roles' `RolePermission` → `Permission.name` rows into a
deduplicated array. `GET /auth/session`'s response `user` object gains the same field for the
frontend's `AuthContext`.

## Migration notes

- All four `Project` columns and both `Repository` columns are nullable — no backfill
  required for existing 001-003 rows; `SpecificationContextService` (feature 003) already
  tolerates a `null` branch (falls back to the "informar manualmente" placeholder it uses
  today).
- No `AuditLog` schema change — only a new call site writing to the existing table, so no
  migration at all for that part.
- Seeding new `Permission`/`RolePermission` rows is idempotent (upsert), safe to re-run
  against the same database used by 001-003's live validation.
