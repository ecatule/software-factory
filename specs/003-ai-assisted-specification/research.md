# Phase 0 Research: AI-Assisted Specification & Increments

No `NEEDS CLARIFICATION` markers remain in `spec.md` (resolved during `/speckit.clarify`).
This document records the technical decisions needed to move from spec to data model/
contracts, each grounded in what already exists in the codebase.

## 1. How the AI round executes (async orchestration)

**Decision**: Reuse `AgentExecution` + the existing BullMQ queue (`EXECUTIONS_QUEUE`,
`apps/api/src/common/queue/queue.module.ts`) and `ExecutionsProcessor`
(`apps/api/src/modules/executions/executions.processor.ts`), exactly as the Developer Agent
already does. Add a new branch in `ExecutionsProcessor.process()` keyed on
`agent.type === "specification_copilot"`, parallel to the existing `"developer"` branch and
the default SDD-pipeline-stage branch.

**Rationale**: Clarifications 2026-08-09 established the round must be async, matching the
Developer Agent's UX (submit → poll status → result). `AgentExecution` already has every
column needed: `status` (QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED), `input`/`output` (Json),
`error`, and — critically — `SpecificationVersion.executionId` already exists as a nullable
FK back to `AgentExecution`. No new table, no new queue.

**Alternatives considered**: A dedicated `SpecificationSession` table with its own worker —
rejected as pure duplication of `AgentExecution`'s job; a synchronous HTTP endpoint that
blocks on the LLM call — rejected per the clarify decision (ties up a request thread for
30-60s+, no resilience if the connection drops mid-call).

## 2. Where `LLMProvider` finally gets called

**Decision**: `ExecutionsProcessor`'s new branch calls
`this.llmProvider.generateStructured<SpecificationProposal>(request)` (the same injected
`LLM_PROVIDER` token already present in the processor's constructor, currently unused for
this purpose). `LLMRequest.prompt` carries the serialized `SpecificationContext`;
`systemPrompt` carries the instruction to return the structured JSON contract (§4 below).

**Rationale**: `packages/infrastructure/src/providers/{claude,chatgpt}.provider.ts` already
implement `generate()`/`generateStructured()` with real HTTP calls to their respective APIs,
selected today via `providers.module.ts`'s `LLM_PROVIDER` factory
(`process.env.LLM_PROVIDER === "claude" ? Claude : ChatGPT`). This feature is simply the
first real caller.

**Alternatives considered**: A new `SpecificationLLMAdapter` wrapping the provider — rejected,
adds a layer with no behavior of its own; the interface already fits.

## 3. `SpecificationContext` assembly

**Decision**: A new pure domain/application service, `SpecificationContextService`
(`apps/api/src/modules/specifications/specification-context.service.ts`), takes a `demandId`
(+ optional `incrementId` for the increment-creation path) and returns a plain object
assembled from existing Prisma queries: `Demand` (+ `Client`, `Project`), `Project.technologies`
via the new `ProjectTechnology` join, `Repository[]` for the project, `Artifact[]` for the
demand, the current `Increment`, the latest `APPROVED` `SpecificationVersion` per document
type (SPEC/PLAN) for the demand, and the human-supplied business/technical input passed in
the request. This object becomes `AgentExecution.input` (persisted verbatim for audit/
traceability, satisfying FR-022) and is serialized into the LLM prompt.

**Rationale**: FR-003/FR-019 both need the identical assembly logic (first specification vs.
increment re-specification differ only in whether a previously-approved version exists) — one
service, called from both the "trigger AI round" and "create increment" code paths, avoids
duplicating the composition logic (constitution IV: avoid duplicated code).

**Alternatives considered**: Inlining context assembly into the controller/processor —
rejected, would duplicate between the "new specification" and "new increment" entry points.

## 4. Structured LLM response contract

**Decision**: A TypeScript interface `SpecificationProposal` (new, in
`packages/domain/src/providers/specification-proposal.ts` or colocated in the
`specifications` module — decided at task-writing time) matching spec FR-005 exactly:
`summary`, `businessRequirements[]`, `businessRules[]`, `acceptanceCriteria[]`, `flows[]`,
`technicalRequirements[]`, `identifiedArtifacts[]`, `suggestedArtifacts[]`, `risks[]`,
`questions[]`, `specifyMarkdown`, `planMarkdown`, `changeSummary[]` (populated only for
increment rounds, per FR-020). The processor validates the shape (required string/array
fields present) before persisting; a malformed response fails the execution with a clear
`error` message rather than silently creating a corrupt draft.

**Rationale**: Directly mirrors the technical doc's own contract (§19 of
`software_factory_tecnico_mvp1_mvp2.md`), which the spec's FR-005/FR-020 already codify at
the business level — no reason to diverge.

**Alternatives considered**: Free-text response parsed with regex/heuristics — rejected,
fragile and unauditable; `generateStructured<T>()` already exists specifically to avoid this.

## 5. Persisting a round's result as a `SpecificationVersion`

**Decision**: On `AgentExecution` completion, the processor upserts the `Specification` row
(`demandId` + `documentType`, exactly as `ExecutionsProcessor.writeSpecificationVersion`
already does for the SDD pipeline) for both `SPEC` and `PLAN` document types, and creates a
new `SpecificationVersion` for each with: `content` = `specifyMarkdown`/`planMarkdown`,
`incrementId` = the demand's current increment, `status = "GENERATED"`, `source = "AI"`,
`executionId` = the `AgentExecution.id`, `llmModel`/`llmProviderConfigurationId` from the
execution's provider config. `versionNumber` keeps incrementing per the existing
`@@unique([specificationId, versionNumber])` constraint — version numbers are NOT reset per
increment, so the full history of a demand's specification stays one continuous, orderable
sequence (satisfies FR-021/FR-007 without restructuring the existing uniqueness rule).

**Rationale**: Reuses `SpecificationsService.createVersion()`'s exact pattern
(`apps/api/src/modules/specifications/specifications.service.ts`) with added fields, rather
than a parallel write path — the existing `diff()`/`restore()` endpoints keep working
unmodified against the same table.

**Alternatives considered**: A `SpecificationVersion` per increment with per-increment
`versionNumber` reset (would require changing the `@@unique` constraint to
`[specificationId, incrementId, versionNumber]`) — rejected as unnecessary churn; a
continuous version counter is simpler and still satisfies every FR/SC (an increment's "own
evolution" is expressed by filtering versions on `incrementId`, not by renumbering).

## 6. Upload-as-version path (added during clarify)

**Decision**: `POST /specifications/:id/versions/upload` (or a `source` field on the existing
`POST /specifications/:id/versions`, decided at contract-writing time in favor of a distinct
endpoint for clearer validation/DTO shape) accepts `specifyMarkdown`/`planMarkdown` content
directly, creates `SpecificationVersion` rows with `source = "UPLOADED"`, `status =
"GENERATED"`, no `executionId` — everything downstream (diff, approve, immutability) is
identical to an AI-produced version, per FR-025.

**Rationale**: FR-024/FR-025 explicitly require the same lifecycle; only the origin differs.
Rejecting non-Markdown/empty uploads (an edge case from spec.md) is simple server-side
validation, no new infrastructure.

## 7. Approval & immutability enforcement

**Decision**: `POST /specifications/:id/versions/:versionNumber/approve` sets `status =
"APPROVED"`, `approvedBy`, `approvedAt`, optional `comment` → `changeSummary` is NOT
overwritten (that's populated at generation time for increment rounds). Immutability (FR-011)
is enforced at the service layer: `createVersion()`/upload/approve all operate by inserting a
new row, never `UPDATE content ...` on an existing row; additionally, once `status =
"APPROVED"`, the service rejects any further write to that specific row (defense in depth,
mirrors the platform's existing soft-delete-guard extension pattern in
`apps/api/src/common/prisma/`).

**Rationale**: Matches FR-010 (any authenticated user may approve — Clarifications
2026-08-09 Q2) and FR-011/SC-002 (immutability as a system guarantee, not a UI convention).

**Alternatives considered**: A Prisma-level trigger/constraint preventing updates to approved
rows — more robust but out of scope for this feature's size; service-layer enforcement is
consistent with how the rest of this codebase enforces invariants (e.g. the soft-delete
guard is also a Prisma Client extension, not a DB trigger) and is the right level of rigor
here.

## 8. `Increment` numbering & the "implicit increment 1" assumption

**Decision**: `Increment.number` is sequential per `Demand`, starting at 1. Increment 1 is
created automatically the first time a `Demand`'s specification flow is touched (first AI
round or first upload) rather than at `Demand` creation time — avoids a data migration for
every existing 001/002 demand and keeps `Increment` creation lazy/on-demand, matching how
`DemandWorkspace` is already created lazily rather than at `Demand`-creation time.

**Rationale**: Spec Assumption states increment 1 is implicit; tying its creation to the
first specification action (rather than `Demand.create()`) means zero backend changes to the
existing `DemandsService.create()` path and no backfill migration for demands created under
001/002 — the first time any of those older demands touches this feature's flow, increment 1
is created for it on the fly.

**Alternatives considered**: Backfilling `Increment` #1 for all existing demands via a Prisma
migration data step — rejected as unnecessary complexity for a lazily-needed row.

**Implementation note (added post-`/speckit.analyze`, finding F1)**: the "ensure current
increment exists" logic must live in a small shared helper created in the Foundational phase
(alongside `SpecificationContextService`, §3 above) — not only inside the `increments` module
(User Story 3) — because User Story 1's AI round and upload paths (T012/T014) also need a
valid `incrementId` to tag their `SpecificationVersion` rows with, and User Story 1 must stay
independently testable without User Story 3 existing yet (spec.md's stated Independent Test).
`IncrementsService.ensureCurrentIncrement(demandId)` is created in Foundational and reused by
both User Story 1 (T012/T014) and User Story 3 (T030).

## 9. `Demand.currentIncrementId` vs. a live `MAX(number)` query

**Decision**: Add `currentIncrementId` as a nullable FK column on `Demand`, updated whenever
a new `Increment` is created (`Increment.status` model handles which increment is "current"
explicitly rather than inferring it from `MAX(number)`).

**Rationale**: Explicit FK is one indexed lookup and matches the pattern already used by
`Specification.currentVersionId`; avoids recomputing "current" via aggregation on every read
(dashboard/cockpit paths that will consume this in feature 004).

## 10. Frontend polling for the AI round

**Decision**: A new `useExecution(id)` hook (`apps/web/src/services/useSpecificationCopilot.ts`
or colocated with `useExecutions.ts`) using the same `refetchInterval` polling convention
already established in `apps/web/src/services/useDemandPolling.ts` (`POLL_INTERVAL_MS`,
2s — spec 001 SC-008), calling the existing `GET /executions/:id`. No new polling mechanism.

**Rationale**: Consistency with the one polling pattern this codebase already has; the
`Execution` type/shape already matches what the UI needs to show status (QUEUED/RUNNING/
COMPLETED/FAILED) without any backend contract change beyond what `CreateExecutionDto`
already needs (see §11).

## 11. Carrying the analyst's input into `AgentExecution.input`

**Decision**: `CreateExecutionDto` gains an optional `input?: Record<string, unknown>` field,
persisted verbatim to `AgentExecution.input` (a column that already exists but is never
populated by `ExecutionsService.create()` today — confirmed by reading
`apps/api/src/modules/executions/executions.service.ts`). The specification-copilot round's
business/technical input is passed through this field.

**Rationale**: Smallest possible change to a shared, already-existing service/DTO rather than
a parallel "create specification execution" endpoint — `POST /executions` remains the single
entry point for triggering any agent, developer or copilot alike.
