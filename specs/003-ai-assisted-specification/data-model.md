# Phase 1 Data Model: AI-Assisted Specification & Increments

All new/extended tables carry the mandatory columns already enforced across this codebase:
`id UUID`, `st_ativo`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`,
`version` (optimistic locking). Soft delete only, enforced by the existing
`softDeleteGuardExtension` Prisma Client extension — no physical delete.

## New: `Technology`

Represents a technology usable by one or more projects (spec User Story 2).

| Field | Type | Notes |
|---|---|---|
| name | String | |
| category | String | Free text (Frontend/Backend/Database/... per spec examples) — not a fixed enum, mirrors `Project.technologies` today being a free string list |
| version | String? | Optional (e.g. "2.x") |
| description | String? | |
| status | String | Default `"ACTIVE"` |

Relationship: N:N with `Project` via `ProjectTechnology`.

## New: `ProjectTechnology` (join table)

| Field | Type | Notes |
|---|---|---|
| projectId | UUID FK → Project | |
| technologyId | UUID FK → Technology | |

`@@id([projectId, technologyId])`, same shape as the existing `ArtifactRepository` join table
pattern, plus a single `stAtivo` column (**correction, made during implementation**: physical
delete is blocked platform-wide by `softDeleteGuardExtension` for *every* model, including
join tables with no other audit columns — "replacing" a project's technology set needs a way
to remove a link without a real `DELETE`, so `stAtivo` is required here even though
`ArtifactRepository` itself never needed removal and so never hit this).

## New: `Increment`

Represents an independent evolution unit within a `Demand` (spec User Story 3).

| Field | Type | Notes |
|---|---|---|
| demandId | UUID FK → Demand | |
| number | Int | Sequential per demand, starting at 1 (research.md §8) |
| title | String? | Short label |
| reason | String | Required — "motivo/descrição da alteração identificada" (FR-017) |
| status | String | `"OPEN"` while its specification isn't yet approved, `"COMPLETED"` once approved — mirrors the simple string-status pattern `Demand.status` already uses rather than a hardcoded enum |
| baseSpecificationVersionId | UUID? FK → SpecificationVersion | The previously-approved version this increment started from (null for increment 1) |

`@@unique([demandId, number])`.

## Extended: `Demand`

| Field | Type | Notes |
|---|---|---|
| currentIncrementId | UUID? FK → Increment | Nullable — null until the first specification action lazily creates increment 1 (research.md §8/§9) |

No other `Demand` columns change — `external_ticket_id`/`due_at` from the source docs are
explicitly deferred (out of scope, spec.md Assumptions).

## Extended: `SpecificationVersion`

| Field | Type | Notes |
|---|---|---|
| incrementId | UUID? FK → Increment | Which increment produced this version; nullable for pre-existing rows from 001/002 (backward compatible) |
| status | String | `DRAFT` \| `GENERATED` \| `REVIEW` \| `APPROVED` \| `REJECTED` \| `SUPERSEDED` (schema models all 6 for forward-compatibility; this feature's tasks only ever assign `GENERATED`, `APPROVED`, or `SUPERSEDED` — see State transitions below) — default `"GENERATED"` for AI/upload output, existing manual-edit rows implicitly `"APPROVED"` (see Migration Notes) |
| source | String | `AI` \| `HUMAN_EDITED` \| `UPLOADED` |
| llmModel | String? | e.g. `"gpt-4o"`/`"claude-sonnet-4"`, from the execution's provider config |
| approvedBy | UUID? | User who approved |
| approvedAt | DateTime? | |
| approvalComment | String? | Optional comment supplied on approval (FR-012 — "comentário opcional") |
| changeSummary | Json? | Populated for increment rounds only (FR-020): `{rulesAdded, artifactsImpacted, apisImpacted, dataImpacted, suggestedTests}` |

`llmProviderConfigurationId` and `executionId` already exist on this model (used unchanged).
`content` already exists and continues to hold the Markdown body (`specifyMarkdown` or
`planMarkdown`, one row per document type per `Specification.documentType`, unchanged from
today). `versionNumber` continues incrementing per `Specification`, not reset per increment
(research.md §5) — `@@unique([specificationId, versionNumber])` is unchanged.

**State transitions** (`status`):

```text
(created) → GENERATED (AI output or upload) → APPROVED
```

Every task in this feature only ever assigns `GENERATED` or `APPROVED`. `DRAFT`, `REVIEW`,
`REJECTED`, and `SUPERSEDED` are modeled now (so the column doesn't need another migration
later) but reserved/unused by this iteration's tasks:
- `DRAFT`/`REVIEW` — a future in-progress-edit / explicit-review-open state.
- `REJECTED` — FR-009's "reject" is satisfied for this iteration by the analyst simply not
  approving a version and requesting a new round instead (T016/T018); no task transitions a
  version to `REJECTED`.
- `SUPERSEDED` — older, never-approved drafts simply stay `GENERATED`; nothing in this
  feature's FRs/SCs requires marking them otherwise once a sibling version is approved.


Only `APPROVED` versions are immutable (research.md §7); all other statuses may be superseded
by a newer version but never mutated in place either — "status" transitions are themselves
recorded via `UPDATE ... SET status = ...`, distinct from `content` which is never updated
after insert on any row, at any status.

## Reused unchanged: `AgentExecution`

No schema change. This feature's "AI Specification Round" (spec Key Entities) *is* an
`AgentExecution` row with `agent.type = "specification_copilot"`. `input` (now actually
populated, research.md §11) holds the assembled `SpecificationContext` + human input;
`output` holds the raw structured LLM response before it's split into `SpecificationVersion`
rows.

## New seed data

`apps/api/prisma/seed.ts`'s `AGENT_CATALOG` gains one row:
`{ name: "SpecificationCopilotAgent", type: "specification_copilot" }`, following the exact
pattern already used for `SpecificationAgent`/`DeveloperAgent`.

## Migration notes

- All new columns on `Demand`/`SpecificationVersion` are nullable or carry safe defaults —
  no backfill required for existing 001/002 data. Existing `SpecificationVersion` rows (from
  the SDD pipeline, User Story 2 of feature 001) get `status = "GENERATED"` and
  `source = "HUMAN_EDITED"` as their column defaults; they remain fully readable/diffable via
  the unchanged `diff()`/`restore()` endpoints. They are not retroactively marked `APPROVED`
  — the immutability guarantee only ever applied going forward from this feature.
- `Demand.currentIncrementId` stays `null` for every demand until it's first touched by this
  feature's flow (lazy increment-1 creation, research.md §8) — no migration data step.
