# Contract: AI-Assisted Specification (the core capability)

**Correction found during live validation (implementation phase)**: a brand-new demand has
no `Specification` row at all — `SpecificationList.tsx`'s only entry point into this
workspace was a link keyed by an existing `specification.id`, so User Story 1's Acceptance
Scenario 1 ("uma demanda sem nenhuma especificação aprovada ainda") had no way to actually
reach the workspace. Fixed by adding
`POST /api/v1/demands/:demandId/specifications/:documentType/ensure` (lazily upserts the
`Specification` container, mirroring `IncrementsService.ensureCurrentIncrement()`), and a
"Start" action in `SpecificationList.tsx` for any document type (`SPEC`/`PLAN`) that doesn't
exist yet for the demand.

Implements spec FR-001 through FR-013, FR-022 through FR-025 (User Story 1). Behind the
existing global `JwtAuthGuard`. No additional role required for any endpoint here — including
approval (Clarifications 2026-08-09 Q2).

## `POST /api/v1/executions` (extended, existing endpoint)

Already exists (001); extended per research.md §11.

- **Body** (extended): `{ agentId, demandId, providerConfigurationId?, pipelineStage?, input? }`
  — `input` is new, optional, `Record<string, unknown>`. For a specification-copilot round,
  the frontend sends the analyst's business+technical fields (FR-001/FR-002) here; the
  backend's `SpecificationContextService` (research.md §3) reads the rest (demand, client,
  project, technologies, repositories, artifacts, prior approved spec/plan) itself — the
  client does not need to assemble or send that part.
- `agentId` = the `SpecificationCopilotAgent` catalog row (`agent.type ===
  "specification_copilot"`).
- **201**: the created `AgentExecution`, `status: "QUEUED"` — identical response shape to
  today.

## `GET /api/v1/executions/:id` (unchanged, existing endpoint)

Polled by the frontend (research.md §10) until `status` is `COMPLETED` or `FAILED`. On
`COMPLETED`, `output` holds the raw `SpecificationProposal` (research.md §4) and one or two
new `SpecificationVersion` rows now exist (`GET /specifications/:id/versions` reflects them —
existing endpoint, unchanged).

## `POST /api/v1/specifications/:id/versions/upload`

New. Implements FR-024/FR-025 (the clarify-added alternative to the AI flow).

- **Body**: `{ specifyMarkdown?, planMarkdown?, reason? }` — at least one of
  `specifyMarkdown`/`planMarkdown` required.
- **Validation**: rejects empty/non-Markdown content with **400** (edge case from spec.md).
- **201**: the created `SpecificationVersion`(s) — `source: "UPLOADED"`, `status:
  "GENERATED"`, `incrementId` = the demand's current increment, no `executionId`.

## `POST /api/v1/specifications/:id/versions/:versionNumber/approve`

New. Implements FR-010 through FR-013.

- **Body**: `{ comment? }`.
- **Validation**: **409** if this is not the specification's latest version (edge case:
  approving a stale version while a newer round is in flight, unless the analyst explicitly
  re-requests approval of that exact version — MVP behavior is to always block, no override
  flag in this iteration); **409** if the version is already a terminal state
  (`APPROVED`/`REJECTED`/`SUPERSEDED`).
- **200**: the version with `status: "APPROVED"`, `approvedBy`, `approvedAt` set. Once
  returned, `PATCH`/`PUT` on this version is permanently rejected (**409**) by the service
  layer (research.md §7) — this is the immutability guarantee (FR-011/SC-002).
- Also marks the demand's `Increment.status = "COMPLETED"` when both `SPEC` and `PLAN`
  document types for that increment are `APPROVED`.

## `GET /api/v1/specifications/:id/versions` (unchanged, existing endpoint)

Now also returns the new columns (`incrementId`, `status`, `source`, `approvedBy`,
`approvedAt`, `changeSummary`) — additive, no breaking change to existing consumers.

## `GET /api/v1/specifications/:id/versions/:a/diff/:b` (unchanged, existing endpoint)

Reused as-is for FR-008 (compare any two versions) — already returns
`{additions, deletions}` line-level Markdown diff.

## Frontend contract

`SpecificationWorkspace.tsx` (replaces `SpecificationEditor.tsx` as the routed page):

- Business input editor + technical input editor (large textareas, FR-001/FR-002).
- "Enviar para IA" button → `POST /executions` (this contract) → shows a processing/status
  indicator via polling `GET /executions/:id` (no blocking spinner over the whole screen —
  the analyst can keep editing/navigating per the async decision).
- On completion: renders the structured proposal (summary/requirements/rules/criteria/flows/
  risks/questions) plus the proposed `specify.md`/`plan.md` content.
- "Nova rodada" (re-submit with adjustments), "Editar diretamente" (falls through to the
  existing `MarkdownEditor` + `createVersion()` path, `source: "HUMAN_EDITED"`), "Anexar
  arquivos prontos" (upload endpoint above).
- Reuses the existing version-history list + `DiffView` from the current
  `SpecificationEditor.tsx` unchanged, now also showing each version's `status`/`source`
  badge (`packages/ui`'s `Badge` component, existing tones).
- "Aprovar" button on the version being reviewed → approve endpoint above.
