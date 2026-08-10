# Phase 0 Research: Advanced Console & Governance

No `NEEDS CLARIFICATION` markers remain in `spec.md`. This document records the technical
decisions needed to move from spec to data model/contracts.

## 1. Granular permissions: where they live and how they're checked

**Decision**: Reuse the existing `Permission`/`RolePermission` models (present since 001,
today only holding one row: `"platform:admin"`) — seed the full FR-004 catalog as additional
`Permission` rows, associate them all with the `admin` role (FR-008), and compute the
authenticated user's effective permission set at **token-issue time**
(`AuthService.issueTokensForVerifiedIdentity()`), embedding it in the JWT payload as
`permissions: string[]` alongside the existing `roles: string[]`. `RbacGuard` gains a second
check: a new `@RequirePermission(...)` decorator (parallel to the existing `@Roles(...)`)
that it evaluates the same way — `context.getHandler()`/`getClass()` metadata, comparing
against `request.user.permissions`.

**Rationale**: Avoids a DB round-trip per request (permissions are already known at token
issue, exactly like roles are today) and avoids a second guard class (constitution III —
extend, don't duplicate). `RbacGuard` already runs globally before every handler (fixed
during 002's live-validation, see that feature's tasks.md) — this is the correct single choke
point for both role and permission checks.

**Alternatives considered**: A separate `PermissionsGuard` — rejected, would need the exact
same global-ordering care that `RbacGuard` itself needed fixing in 002, for no benefit; a
permission-check DB query per request — rejected, unnecessary latency when the JWT already
carries roles the same way.

## 2. Permission catalog seeding

**Decision**: `apps/api/prisma/seed.ts`'s `seedIdentity()` gains the FR-004 catalog
(`DEMAND_READ`, `DEMAND_WRITE`, `SPECIFICATION_WRITE`, `SPECIFICATION_APPROVE`,
`AGENT_EXECUTE`, `GIT_WRITE`, `PR_CREATE`, `AUDIT_READ`) as `Permission` upserts, each
associated with the `admin` role via `RolePermission` upsert (FR-008) — same idempotent
upsert pattern already used for `"platform:admin"`.

**Rationale**: Existing seed already establishes the exact pattern needed; no new seeding
mechanism required.

## 3. Frontend permission awareness

**Decision**: `GET /auth/session`'s response gains a `permissions: string[]` field (mirrors
the JWT's own claim — decoded from the access token, same as `roles` already is today in
`AuthContext.tsx`). `AuthContext` exposes `hasPermission(permission: string): boolean`,
consumed by any component that needs FR-007a's hide/disable behavior (e.g. the "Aprovar"
button in `SpecificationWorkspace.tsx`).

**Rationale**: Mirrors the existing `roles`-based `NavShell.tsx`/`ProtectedRoute.tsx`
filtering pattern from 002 exactly — same shape, new claim.

## 4. Which endpoints get which permission (FR-006)

**Decision**: Map spec FR-006's list directly onto existing endpoints via
`@RequirePermission(...)`:

| Permission | Endpoint(s) |
|---|---|
| `SPECIFICATION_APPROVE` | `POST /specifications/:id/versions/:versionNumber/approve` |
| `SPECIFICATION_WRITE` | `POST /specifications/:id/versions`, `.../upload` |
| `AGENT_EXECUTE` | `POST /executions` |
| `GIT_WRITE` | `POST /demands/:id/branch`, `.../commit`, `.../pull-request`'s branch/commit steps |
| `PR_CREATE` | `POST /demands/:id/pull-request` |
| `DEMAND_READ` | `GET /demands`, `GET /demands/:id` (+ its read sub-resources) |
| `DEMAND_WRITE` | `POST /demands`, `PATCH /demands/:id`, `POST /demands/:id/increments` |
| `AUDIT_READ` | `GET /audits` |

**Rationale**: Directly transcribes FR-006's own enumeration — no new design decision needed,
just endpoint identification against the existing controllers built across 001-003.

## 5. Dashboard KPIs — data sources

**Decision**: Extend `DashboardService.getSummary()` with parallel aggregation queries:
- Open/blocked/in-specification/in-development counts: `Demand.groupBy({by:["status"]})`
  (already computed today as `stageCounts`) bucketed client-side into the FR-009 categories
  by status-key membership (e.g. `BLOCKED` status = "bloqueadas"), no new query needed.
- PRs open: `PullRequest.count({where:{status:"OPEN"}})`.
- Tests failing: `TestExecution.count({where:{status:"FAILED"}})` — spec says "testes
  falhando" (current state), not historical, so this counts the latest execution per
  suite/demand where relevant, or simply all currently-`FAILED` rows (no re-run superseding
  logic exists yet — reasonable default, consistent with `Tests.tsx`'s existing display).
- Agents running: `AgentExecution.count({where:{status:"RUNNING"}})`.
- Demands by client: `Demand.groupBy({by:["clientId"]})`, joined with `Client.name`.
- Avg time per stage: see §6 below — the one finding that needs new instrumentation.

**Rationale**: Every KPI except "avg time per stage" is a direct `count`/`groupBy` against
existing tables — no new persistence.

## 6. Avg time per workflow stage — a real gap found during research

**Finding**: `WorkflowsService.transition()`/`advanceToNextStage()` update `Demand.status`
directly via Prisma, called either from a controller (HTTP request, wrapped by the global
`AuditInterceptor`) or — critically — from `ExecutionsProcessor` (a BullMQ worker, **not**
an HTTP request). The global `AuditInterceptor` only wraps the HTTP request/response cycle,
so stage transitions triggered from the worker are **never audited today** — there is no
existing record of *when* a demand entered or left a given stage, so "average time per stage"
(FR-011) cannot be computed from any table that exists today.

**Decision**: Instrument `WorkflowsService.transition()` and `advanceToNextStage()` themselves
to explicitly write an `AuditLog` row on every stage change (`action: "STAGE_TRANSITION"`,
`entityType: "demands"`, `entityId: demandId`, `before: {status: oldStatus}`,
`after: {status: newStatus}`), regardless of whether the call originated from an HTTP request
or the worker. `DashboardService` then computes average stage duration by pairing consecutive
`STAGE_TRANSITION` rows per demand (entry time of stage N → entry time of stage N+1) and
averaging the deltas per `before.status` value across all demands.

**Rationale**: Reuses the existing `AuditLog` table (no new table — consistent with this
feature's "extend, don't duplicate" pattern) and fixes a real observability gap (worker-driven
mutations bypassing the audit trail) that would otherwise silently affect more than just this
one KPI. Explicit `prisma.db.auditLog.create()` calls inside the service (rather than relying
on the HTTP interceptor) work identically regardless of caller.

**Alternatives considered**: A dedicated `WorkflowStageHistory` table with `enteredAt`/
`exitedAt` columns — more directly queryable, but a new table for data `AuditLog` can already
represent; rejected as unnecessary duplication given the fix is small either way. Approximating
via `Demand.updatedAt` — rejected, `updatedAt` changes on any field update, not just `status`,
so it can't reliably mark stage boundaries.

## 7. Demands list enrichment — data sources

**Decision**: Extend `DemandsService.list()`'s `where` clause with `agentId` (via a
`AgentExecution` exists-subquery keyed to the demand's latest execution), `prStatus`, and a
`createdAfter`/`createdBefore` date range (spec's "período" — reasonable default: filters on
`Demand.createdAt`, per research.md's own Assumption already documented in spec.md).
`include`s `client: {select:{name}}`, `project: {select:{name}}`, `currentIncrement: {select:
{number, status}}` for the new columns (FR-013); "agente atual" and "PR" columns resolved via
a lightweight per-row lookup of the demand's latest `AgentExecution`/`PullRequest` (same
pattern already used by `DemandsController.trace()` for related-resource lookups).

**Rationale**: `Demand.currentIncrementId` (feature 003) and the existing `AgentExecution`/
`PullRequest` tables already carry everything FR-013 needs — no new columns.

## 8. Monday import endpoint

**Decision**: `POST /demands/import` (new), body `{externalId, clientId, projectId}`, calls
the already-implemented `DemandsService.importFromProvider(externalId, clientId, projectId)`
(present since 001, never exposed by a route) — same 409-on-duplicate behavior already
guaranteed by that method (FR-016), unchanged.

**Rationale**: Zero new business logic — this is purely wiring an existing service method to
a new HTTP route + a form in `Demands.tsx`.

## 9. DemandCockpit tabs — URL-linkable, per Clarifications

**Decision**: `DemandCockpit.tsx` becomes a shell rendering a tab nav + the active tab's
content, keyed by a new `:tab` route segment (`/demands/:demandId/:tab`, defaulting to
`summary` via a redirect from `/demands/:demandId`). Each tab's content is the exact JSX
already in today's flat `DemandCockpit.tsx`, relocated into
`apps/web/src/components/cockpit-tabs/{Summary,Specification,Artifacts,Development,Tests,
Git,Timeline,Audit,Tasks}Tab.tsx` — no new data fetching, `useDemandPolling` (already
fetch-once-plus-manual-refresh since the earlier bug-fix round) is called once at the shell
level and passed down, satisfying FR-019's "don't refetch already-obtained data" via normal
React prop-passing (no per-tab re-fetch).

**Rationale**: Matches Clarifications 2026-08-09 (linkable tabs) with the smallest possible
change to existing, already-working data-fetching — splits presentation only.

**Tasks tab**: per spec.md's own Assumption, no dedicated task-tracking entity exists yet;
`TasksTab.tsx` renders an explanatory placeholder (FR-017's acceptance scenario 3), not a
fabricated data source.

## 10. Manual Artifact creation

**Decision**: `Artifacts.tsx` gains a `Modal`+`FormField` create form (same pattern as
`Clients.tsx`/`Technologies.tsx`) calling the already-existing
`POST /demands/:demandId/artifacts` (`DemandArtifactsController`, present since 001, never
exposed by a form) — a new `useCreateArtifact()` hook added to `useArtifacts.ts`.

**Rationale**: Zero new backend work — purely a missing frontend form for an endpoint that
already exists, exactly as spec.md's own framing describes it.

## 11. Project/Repository branch and environment fields

**Decision**: `Project` gains `productionBranch String?`, `homologationBranch String?`,
`homologationEnvironment String?`, `productionEnvironment String?`. `Repository` gains
`productionBranch String?`, `homologationBranch String?`. `SpecificationContextService`
(feature 003) is extended to prefer the demand's project's repository-level branch fields
when a repository is linked to the demand's artifacts, falling back to the project-level
fields otherwise (per spec.md's Edge Cases: multiple repositories may have diverging
branches).

**Rationale**: Directly satisfies FR-001-003; nullable columns need no migration/backfill
for existing rows (same pattern as every prior nullable extension in 002/003).
