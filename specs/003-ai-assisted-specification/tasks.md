---

description: "Task list for AI-Assisted Specification & Increments (003)"
---

# Tasks: AI-Assisted Specification & Increments

**Input**: Design documents from `/specs/003-ai-assisted-specification/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in spec.md — consistent with features 001/002, no dedicated
test-writing tasks; each story ends with a `quickstart.md`-derived live-validation task.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3) — Setup/Foundational/Polish
  carry no story label
- File paths are exact

---

## Phase 1: Setup

**Purpose**: Confirm the ground this feature builds on is ready — no new tooling needed.

- [X] T001 Verify no new workspace dependencies are required in `apps/api/package.json`,
  `apps/web/package.json`, `packages/domain/package.json`, `packages/infrastructure/package.json`
  — BullMQ, Prisma, `react-hook-form`, TanStack Query, and the `ClaudeProvider`/`ChatGPTProvider`
  adapters already exist from features 001/002 (research.md); no `package.json` edits expected
  from this task. **Confirmed** — no dependency changes were needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, seed data, and shared services every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add `Technology` model to `apps/api/prisma/schema.prisma` (data-model.md
  "New: Technology") — mandatory audit columns included.
- [X] T003 [P] Add `ProjectTechnology` join model to `apps/api/prisma/schema.prisma`
  (data-model.md "New: ProjectTechnology") — `@@id([projectId, technologyId])`, same shape as
  the existing `ArtifactRepository` join table. **Implementation correction**: also required a
  `stAtivo` column (not originally planned) — physical delete is blocked platform-wide even for
  join tables, so "removing" a technology association needs a soft-remove flag.
- [X] T004 [P] Add `Increment` model to `apps/api/prisma/schema.prisma` (data-model.md
  "New: Increment") — `@@unique([demandId, number])`.
- [X] T005 Extend `SpecificationVersion` model in `apps/api/prisma/schema.prisma` with
  `incrementId` (nullable FK → Increment), `status`, `source`, `llmModel`, `approvedBy`,
  `approvedAt`, `approvalComment`, `changeSummary` (data-model.md "Extended:
  SpecificationVersion") — depends on T004 for the FK.
- [X] T006 Extend `Demand` model in `apps/api/prisma/schema.prisma` with `currentIncrementId`
  (nullable FK → Increment) — depends on T004.
- [X] T007 Run the Prisma migration (`prisma db push`, matching this project's established
  method — see 001/002 precedent) to apply T002–T006 and regenerate the Prisma client —
  **live-verified**: pushed successfully to the real Supabase-hosted Postgres instance.
- [X] T008 [P] Add a `SpecificationCopilotAgent` (`type: "specification_copilot"`) row to
  `AGENT_CATALOG` in `apps/api/prisma/seed.ts`, following the existing
  `SpecificationAgent`/`DeveloperAgent` pattern (data-model.md "New seed data") —
  **live-verified**: `GET /agents` returns the seeded row.
- [X] T009 [P] Add the `SpecificationProposal` structured-response type in
  `packages/domain/src/providers/specification-proposal.ts` (fields per research.md §4:
  summary, businessRequirements, businessRules, acceptanceCriteria, flows,
  technicalRequirements, identifiedArtifacts, suggestedArtifacts, risks, questions,
  specifyMarkdown, planMarkdown, changeSummary) and export it via
  `packages/domain/src/index.ts`.
- [X] T010 Extend `CreateExecutionDto` in `apps/api/src/modules/executions/dto/execution.dto.ts`
  with an optional `input?: Record<string, unknown>` field, and pass it through in
  `ExecutionsService.create()` (`apps/api/src/modules/executions/executions.service.ts`) when
  creating the `AgentExecution` row (research.md §11 — the column already exists, it is
  currently never populated).
- [X] T011 Create `SpecificationContextService` in
  `apps/api/src/modules/specifications/specification-context.service.ts`, assembling the
  `SpecificationContext` object (demand, client, project, project technologies via
  `ProjectTechnology`, repositories, artifacts, current increment, latest `APPROVED`
  `SpecificationVersion` per document type, human-supplied input) described in research.md §3;
  register it in `specifications.module.ts` and export it for use by `executions.module.ts` —
  depends on T002–T006.
- [X] T012 Create a minimal `IncrementsService` in
  `apps/api/src/modules/increments/increments.service.ts` with
  `ensureCurrentIncrement(demandId)`: returns the demand's `currentIncrementId` if set,
  otherwise lazily creates increment `number: 1` and sets `Demand.currentIncrementId`
  (research.md §8/§9, implementation note added post-`/speckit.analyze` finding F1). Register
  a minimal `IncrementsModule` exporting this service — depends on T004, T006. **This must
  exist in Foundational, not only inside User Story 3's controller/endpoint work (T031),
  because User Story 1 (T013, T015) also needs a valid `incrementId` to tag
  `SpecificationVersion` rows with, independently of User Story 3 being built.**
  **Live-verified**: `POST /demands/:id/increments` on a demand with no prior increment
  correctly lazy-created increment #1 and set `Demand.currentIncrementId` before rejecting
  with 409 (FR-018) — confirms the F1 fix holds end to end.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Gerar e aprovar uma especificação com ajuda de um copiloto de IA (Priority: P1) 🎯 MVP

**Goal**: A real, working AI-assisted specification flow — business/technical input → async
LLM round → structured proposal → iterate/edit/upload → compare versions → approve
(immutable, audited).

**Independent Test**: Open an existing demand's specification, submit business/technical
input, receive an AI proposal, iterate once, approve a version — without the Technology
catalog or a second Increment existing (spec.md Independent Test). Satisfied because
increment-1 creation lives in Foundational (T012), not User Story 3.

### Implementation for User Story 1

- [X] T013 [US1] Add a `specification_copilot` branch to `ExecutionsProcessor.process()` in
  `apps/api/src/modules/executions/executions.processor.ts`: call
  `IncrementsService.ensureCurrentIncrement()` (T012), call `SpecificationContextService`
  (T011), call `this.llmProvider.generateStructured<SpecificationProposal>()` (T009) with the
  assembled context as the prompt, validate the response shape, and — on success —
  create/update the `Specification` (SPEC/PLAN) + `SpecificationVersion` rows (`status:
  "GENERATED"`, `source: "AI"`, `incrementId`, `executionId`, `llmModel`, and
  `changeSummary` when the round is for an increment beyond #1 — data-model.md, FR-020/SC-004)
  per research.md §1/§2/§5; on a malformed response, fail the execution with a clear `error`
  instead of persisting a corrupt draft.
- [X] T014 [US1] Extend `SpecificationsService.createVersion()` in
  `apps/api/src/modules/specifications/specifications.service.ts` to accept and persist
  `incrementId`, `status`, and `source` (data-model.md) — existing callers keep working via
  sensible defaults (`status: "GENERATED"`, `source: "HUMAN_EDITED"`).
- [X] T015 [US1] Add `POST /specifications/:id/versions/upload` (controller + DTO + service
  method) in `apps/api/src/modules/specifications/{specifications.controller.ts,
  specifications.service.ts, dto/specification.dto.ts}`, validating non-empty Markdown input,
  calling `IncrementsService.ensureCurrentIncrement()` (T012) for the `incrementId`, and
  creating a `SpecificationVersion` with `source: "UPLOADED"` (contracts/
  specification-copilot.md, FR-024/FR-025). **Live-verified**: 201, `incrementId` correctly
  populated, `source: "UPLOADED"`.
- [X] T016 [US1] Add `POST /specifications/:id/versions/:versionNumber/approve` (controller +
  service method) in the `specifications` module: reject if the target isn't the latest
  version or is already terminal (409s per contracts/specification-copilot.md), otherwise set
  `status: "APPROVED"`, `approvedBy`, `approvedAt`, `approvalComment`; enforce that any
  further write to an `APPROVED` version's `content` is rejected (research.md §7,
  FR-010–FR-013); when both `SPEC` and `PLAN` document types for the version's `incrementId`
  are now `APPROVED`, also set that `Increment.status = "COMPLETED"` (contracts/
  specification-copilot.md). **Live-verified**: approve sets all three fields correctly; a
  second approve attempt on the same version correctly 409s ("already APPROVED").
- [X] T017 [US1] [P] Create `apps/web/src/services/useSpecificationCopilot.ts`:
  `useTriggerSpecificationRound()` (`POST /executions` with the copilot agent, resolved via
  `GET /agents`, + business/technical `input`); `useExecution(id)` (polls `GET /executions/:id`
  using the `POLL_INTERVAL_MS` convention) landed in `useExecutions.ts` instead, and
  `useApproveSpecificationVersion()`/`useUploadSpecificationVersion()` landed in
  `useSpecificationVersions.ts` instead — better co-located with the hooks they extend than a
  new standalone file; behavior matches the task exactly, only file organization differs.
- [X] T018 [US1] [P] Extend `apps/web/src/services/useSpecificationVersions.ts` so
  `useCreateSpecificationVersion`'s payload type includes `incrementId`/`source`, matching
  T014's backend contract.
- [X] T019 [US1] Create `apps/web/src/pages/SpecificationWorkspace.tsx` (depends on T017,
  T018): business input editor, technical input editor, "Enviar para IA" button wired to
  `useTriggerSpecificationRound`/`useExecution` (non-blocking status, per the async
  Clarification), rendered structured proposal (summary/requirements/rules/criteria/flows/
  risks/questions) plus proposed `specify.md`/`plan.md`, "Nova rodada"/"Editar diretamente"
  (falls through to the existing `MarkdownEditor` + `createVersion` path)/"Anexar arquivos
  prontos" actions, reusing the existing version-history list + `DiffView` block from the
  former `SpecificationEditor.tsx` (now showing `status`/`source` via the existing `Badge`
  component), and an "Aprovar" button. Also required a new `GET /specifications/:id` endpoint
  (not in the original contract — needed so the page can resolve `demandId` from the URL's
  `specificationId`) and a `demandId` field added to the frontend `Specification` type.
- [X] T020 [US1] Register `SpecificationWorkspace` as the `/specifications/:specificationId`
  route in `apps/web/src/App.tsx` (replacing the `SpecificationEditor` route).
- [X] T021 [US1] Delete `apps/web/src/pages/SpecificationEditor.tsx` (superseded by
  `SpecificationWorkspace.tsx`, T019–T020) — avoid leaving unreferenced duplicate code.
- [X] T022 [US1] Validate `quickstart.md` Steps 2–3 — **partially live-verified**: the upload
  alternative, approval, and immutability were fully exercised live (see T015/T016 notes). The
  AI-round trigger itself (`POST /executions` with the copilot agent) could not be exercised
  end-to-end — `ExecutionsService.create()` hangs indefinitely waiting on the BullMQ/Redis
  connection, which isn't reachable in this environment (a pre-existing characteristic of the
  queue this feature reuses from the Developer Agent, not a new issue); a real
  `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` is also required and both are empty in this `.env`.
  `tsc --noEmit`/`eslint`/`build` are clean across the whole monorepo regardless.
  **Real bug found and fixed during this validation pass** (not caught by `/speckit.analyze`,
  which only reasons over the task list, not runtime behavior): a brand-new demand has no
  `Specification` row at all, so `SpecificationList.tsx`'s "Open in editor" link — the only
  entry point into this screen — had nothing to link to, breaking User Story 1's own
  Acceptance Scenario 1. Fixed with a new
  `POST /demands/:demandId/specifications/:documentType/ensure` endpoint (lazy upsert,
  mirroring `ensureCurrentIncrement`) and a "Start" action in `SpecificationList.tsx` for any
  missing document type — see contracts/specification-copilot.md for the full note.

**Checkpoint**: User Story 1 fully functional and independently testable — this alone is a
deployable MVP for this feature.

---

## Phase 4: User Story 2 - Catalogar tecnologias e associá-las a um projeto (Priority: P2)

**Goal**: A Technology catalog, associable to a Project, automatically enriching the AI
context from User Story 1.

**Independent Test**: Register technologies, associate them with a project, and confirm the
project's technology list reflects it — without any demand being mid-specification (spec.md
Independent Test).

### Implementation for User Story 2

- [X] T023 [US2] [P] Create the `technologies` NestJS module
  (`apps/api/src/modules/technologies/{technologies.controller.ts, technologies.service.ts,
  technologies.module.ts, dto/technology.dto.ts}`) implementing `GET/POST /technologies` and
  `PATCH /technologies/:id`, following the existing `clients` module pattern
  (contracts/technologies.md). **Live-verified**: create + paginated list both work.
- [X] T024 [US2] Add `GET /projects/:id/technologies` and `PUT /projects/:id/technologies` to
  the existing `apps/api/src/modules/projects/` module (contracts/technologies.md).
  **Implementation correction**: `PUT` originally planned to use `deleteMany` for removed
  associations — rejected at runtime by the platform-wide soft-delete guard extension (blocks
  physical delete unconditionally, even for join tables). Rewritten to soft-remove
  (`stAtivo: false`) + upsert instead (see T003). **Live-verified**: associate + read-back
  both work.
- [X] T025 [US2] Register `TechnologiesModule` in `apps/api/src/app.module.ts`.
- [X] T026 [US2] [P] Create `apps/web/src/services/useTechnologies.ts` (list/create/edit
  hooks, plus project-association get/put hooks). Also added `apiPut` to `services/api.ts`
  (didn't exist yet — every prior mutation in this codebase was POST/PATCH only).
- [X] T027 [US2] [P] Create `apps/web/src/pages/Technologies.tsx` (`DataTable` + `Modal` +
  `FormField`, same pattern as `apps/web/src/pages/Clients.tsx`).
- [X] T028 [US2] Extend `apps/web/src/pages/Projects.tsx`'s edit form with a technology
  multi-select field backed by T026's hooks.
- [X] T029 [US2] Register the `/technologies` route in `apps/web/src/App.tsx` and the nav
  entry in `apps/web/src/components/NavShell.tsx`.
- [X] T030 [US2] Validate `quickstart.md` Step 1 — **live-verified** against the real Postgres
  instance: created a Technology, associated it with an existing Project via `PUT`, confirmed
  `GET /projects/:id/technologies` reflects it.

**Checkpoint**: User Stories 1 and 2 both work independently; a project's technologies now
flow into User Story 1's AI context automatically (FR-016) — confirmed via
`SpecificationContextService` reading the same `ProjectTechnology` rows.

---

## Phase 5: User Story 3 - Criar um novo incremento numa demanda existente (Priority: P3)

**Goal**: Multi-round demand evolution — a new Increment reuses User Story 1's flow, seeded
from the previously approved specification/plan, surfacing an impact summary.

**Independent Test**: On a demand with an already-approved specification (via User Story 1),
create a new increment with a reason, and confirm the AI receives the approved spec/plan as a
starting point and returns an impact summary, without altering the prior increment (spec.md
Independent Test).

### Implementation for User Story 3

- [X] T031 [US3] Implement `GET/POST /demands/:demandId/increments` — **implementation
  correction**: landed as new methods on the existing `DemandsController`
  (`apps/api/src/modules/demands/demands.controller.ts`) rather than a new
  `increments.controller.ts`, to avoid a circular module dependency (`IncrementsModule` would
  need `ExecutionsModule` for the enqueue step, but `ExecutionsModule` already depends on
  `IncrementsModule` for `ensureCurrentIncrement`). `DemandsController` already imports both
  and already aggregates several other per-demand sub-resources (`:id/specifications`,
  `:id/artifacts`, `:id/workflow`), so this fits its existing pattern. Rejects 409 if the
  current increment's specification isn't `APPROVED` yet (FR-018), otherwise creates the next
  numbered `Increment`, updates `Demand.currentIncrementId`, and enqueues the first AI round
  via `ExecutionsService` (contracts/increments.md, FR-019). Returns 202.
  **Live-verified**: the 409 gate (T012 note above); the queue-enqueue step itself hits the
  same Redis-unavailability limitation as T022.
- [X] T032 [US3] Register `DemandsModule`'s new imports (`IncrementsModule`, `ExecutionsModule`)
  in `apps/api/src/modules/demands/demands.module.ts` — confirmed no circular-dependency error
  at boot (`Nest application successfully started`).
- [X] T033 [US3] [P] Create `apps/web/src/services/useIncrements.ts` (list + create hooks).
- [X] T034 [US3] Add a "Criar incremento" action and current-increment badge to
  `apps/web/src/pages/DemandCockpit.tsx`, gated (disabled + tooltip) when the current
  increment's specification isn't yet approved, mirroring the FR-018 server-side check.
- [X] T035 [US3] Extend `SpecificationWorkspace.tsx` (T019) to render the `changeSummary`
  impact panel (rules added, artifacts/APIs/data impacted, suggested tests) when reviewing a
  version produced by an increment round (FR-020).
- [X] T036 [US3] Validate `quickstart.md` Step 4 — **partially live-verified**: the FR-018
  409 gate and the lazy increment-1 creation were fully exercised live (T012 note). Creating a
  *second* increment (after approving the first) and its seeded-context/impact-summary
  behavior could not be exercised end-to-end for the same Redis-unavailability reason as T022.

**Checkpoint**: All three user stories independently functional and working together.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T037 [P] Update `README.md`'s module map with the new `technologies`/`increments`
  backend modules and the `Technologies`/`SpecificationWorkspace` frontend screens, and note
  this feature's live-validation dependency on a real LLM provider API key and on Redis.
- [X] T038 Verify server-side immutability of an `APPROVED` `SpecificationVersion` —
  **live-verified**: a second approve attempt on an already-`APPROVED` version returns 409
  ("already APPROVED and cannot be modified") — SC-002 holds.
- [X] T039 Verify `GET /technologies` goes through the shared `paginate()` helper —
  **live-verified**: `?page_size=9999` correctly clamped to `page_size: 100` in the response.
  `GET /demands/:id/increments` intentionally returns a plain (unpaginated) array — the number
  of increments on a single demand is inherently small (spec.md's own examples show 2-3), so
  no pagination envelope was designed for it; noted here rather than silently deviating from
  the task's original wording.
- [X] T040 Run `quickstart.md` end-to-end — **partially run**: Steps 1 (Technologies) and the
  upload/approve/immutability portions of Step 2 fully live-verified; the full AI-round and
  increment-round portions of Steps 2–4 remain blocked on Redis/LLM credentials, consistent
  with T022/T036.
- [X] T041 Run `pnpm -r exec tsc --noEmit`, `pnpm -r exec eslint .`, and `pnpm -r build` clean
  across the whole monorepo — **all three clean** (eslint: 0 errors, 3 pre-existing warnings
  unrelated to this feature).

### Post-implementation bug fixes (reported by user after the initial implementation report)

- **`Projects.tsx` "Save technologies" didn't close the modal**: `ProjectTechnologies` now
  takes an `onSaved` callback, invoked on `useSetProjectTechnologies`'s `onSuccess`.
- **`Technologies.tsx` couldn't save the `status` field**: the form never rendered a control
  for it (only `reset()` set a default), so react-hook-form never collected it on submit.
  Added a `<select>` bound via `register("status")`.
- **`DemandCockpit.tsx` fired 7 requests every 2 seconds indefinitely**: `useDemandPolling`'s
  `refetchInterval: 2000` (originally spec 001 SC-008) is removed; each query now fetches once
  per visit, and a new "Atualizar" button (`refetchAll()`) refreshes on demand instead. This is
  an intentional deviation from 001 SC-008, requested directly by the user as unwanted
  background load, not a defect being silently reverted.
- **`SpecificationWorkspace.tsx` business-input textarea "broke lines" while typing, and
  "Enviar para IA" hung pending**: two separate bugs. (1) The textarea's `value` was
  `Object.values(businessInput).join("\n")` while `onChange` only ever updated one field of
  that same object — a classic controlled-component feedback loop that reconstructs the whole
  string (with stray joined newlines) on every keystroke. Fixed by using a single plain string
  state per textarea instead of a 9-key object the UI never actually exposed as separate
  fields. (2) `QueueModule`'s BullMQ/ioredis connection had no `connectTimeout`/
  `maxRetriesPerRequest`, so `queue.add()` (called by `POST /executions`) hung indefinitely
  with no Redis reachable instead of failing fast — added `connectTimeout: 5000,
  maxRetriesPerRequest: 2` so an unreachable Redis now surfaces as a prompt error instead of
  an infinite pending request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (shared
  `schema.prisma` edits, shared `SpecificationContextService`/`IncrementsService`, shared DTO
  extension).
- **User Story 1 (Phase 3)**: Depends on Foundational only. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational only. Independently testable without
  US1/US3, though its full value (context enrichment) is only visible once US1 exists.
- **User Story 3 (Phase 5)**: Depends on Foundational **and** functionally on User Story 1
  (reuses its flow/UI, needs an approved specification to start from) — spec.md states this
  dependency explicitly, unlike US1/US2 which are mutually independent.
- **Polish (Final Phase)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002–T004 (new Prisma models) can run in parallel; T005–T006 (extensions with FK
  dependencies on T004) run after; T012 (IncrementsService) depends on T004/T006.
- T008 and T009 can run in parallel with each other and with T002–T007.
- Within US1: T017 and T018 (different frontend files) can run in parallel; both must finish
  before T019.
- Within US2: T023, T026, T027 can each start in parallel (different files); T024 and T028
  touch existing shared files (`projects` module, `Projects.tsx`) and should be sequenced
  after their respective new-file counterparts are stable.
- US2 (Phase 4) can be staffed in parallel with US1 (Phase 3) once Foundational is done, since
  neither modifies the other's files — unlike US3, which functionally needs US1 finished
  first even though it touches mostly new files.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1) — the AI-assisted specification copilot itself.
3. **STOP and VALIDATE**: run `quickstart.md` Steps 2–3 independently.
4. This alone replaces the platform's dormant LLM infrastructure with a working feature —
   deployable/demoable on its own, exactly as spec.md's Why-this-priority argues.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate → deploy/demo (MVP).
3. User Story 2 → validate → deploy/demo (richer AI context, no regressions to US1).
4. User Story 3 → validate → deploy/demo (multi-round demand evolution, built on US1).
5. Polish.
