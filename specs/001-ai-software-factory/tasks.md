---

description: "Task list template for feature implementation"
---

# Tasks: AI Software Factory — Core Platform

**Input**: Design documents from `/specs/001-ai-software-factory/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not explicitly requested in spec.md, so no dedicated test-writing tasks are
generated; each user story instead ends with a validation task derived from `quickstart.md`.

**Organization**: Tasks are grouped by user story (spec.md priorities: P1 = US1–5, P2 = US6–9)
to enable independent implementation and testing of each story. Within the P1 group and
within the P2 group, stories build on each other in the order below (see Dependencies) rather
than being fully parallel — each story is still independently *testable* once its
prerequisites exist.

**Revision note (2026-08-07)**: T009-T011 were inserted into the Foundational phase to close
3 CRITICAL gaps found by `/speckit.analyze` (E1: `Workflow`/`WorkflowStage`/`WorkflowTransition`
models were referenced by a task but never created; E2: `Provider`/`ProviderConfiguration`
models likewise; D1: soft-delete was documented but not technically enforced). Every task from
the original T009 onward shifted by +3; dependency notes below reflect the new numbering.

**Live-validation note (2026-08-07)**: after all 84 tasks were implemented and type-/lint-clean,
the user provided a real (isolated-schema) Postgres and the stack was actually run — build,
migrate, seed, and boot the API, then exercised via real HTTP requests. This surfaced and fixed
4 real runtime bugs that static checks (`tsc --noEmit`, `eslint`) could not catch:
1. `packages/domain/src/index.ts` re-exported a directory (`./providers`) implicitly, which
   Node 22's module resolution rejected at runtime (`ERR_UNSUPPORTED_DIR_IMPORT`) — fixed to
   `./providers/index`.
2. `apps/api/package.json` never declared `@software-factory/{domain,infrastructure,config}` as
   real dependencies (only TS path-aliases existed, which don't create the node_modules links
   Node needs) — added as `workspace:*` dependencies, and the internal packages' `main`/`types`
   now point at their own compiled `dist/` output instead of `.ts` source, with cross-package
   TS path-mapping removed from `tsconfig.base.json` so type-checking matches runtime resolution.
3. `apps/api`'s build output nested unexpectedly (`dist/apps/api/src/main.js` instead of
   `dist/main.js`) because TS was computing a wide common rootDir across the (now-removed)
   cross-package path aliases — resolved itself once fix #2 removed those aliases.
4. `ExecutionsModule` never imported `QueueModule`, so Nest couldn't resolve the injected BullMQ
   queue token at startup — added the import.

With those fixed, live-verified end-to-end: `POST/GET /clients`, `/projects`, `/demands`
(including the FR-028 409 rejection), `GET /demands/:id/{workflow,timeline,trace}`,
`POST /demands/:id/workspace` (real `spec/`+`artefatos/` directories on disk — this also
surfaced and fixed a 5th bug: the workspace root was computed from `process.cwd()`, which put
workspaces outside the repo when the API was launched from the monorepo root, rather than
relative to the compiled file's own location), `GET /workspaces/:id/tree`, `GET /audits`,
Swagger UI at `/docs`, and JWT auth rejection (401 with no/invalid token). **Not** live-verified:
US2/US6-9's external integrations (BullMQ execution against a real LLM/Spec Kit CLI, and
GitHub-backed branch/commit/PR) — these need Redis plus real LLM and GitHub credentials, which
weren't available in this session.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web application monorepo per `plan.md`: `apps/api/src/` (NestJS backend), `apps/web/src/`
(React frontend), `packages/{domain,application,infrastructure,contracts,shared,config,ui}/`
(shared layers), `apps/api/prisma/` (schema/migrations), `database/seeds/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create pnpm workspace root config (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`) at repository root
- [X] T002 [P] Scaffold `apps/api` NestJS project (`apps/api/src/main.ts`, `apps/api/src/app.module.ts`)
- [X] T003 [P] Scaffold `apps/web` Vite + React + TypeScript project (`apps/web/src/main.tsx`, `apps/web/src/App.tsx`)
- [X] T004 [P] Scaffold `packages/{domain,application,infrastructure,contracts,shared,config,ui}` with a `package.json` + `tsconfig.json` per package
- [X] T005 [P] Configure root ESLint + Prettier config (`.eslintrc.cjs`, `.prettierrc`) shared across `apps/` and `packages/`
- [X] T006 Create `docker-compose.yml` (`web`, `api`, `postgres`, `redis`, `minio` services) and `.env.example` at repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Initialize Prisma in `apps/api` (`apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`) with `DATABASE_URL` datasource
- [X] T008 [P] Document the shared base-model fields (`id`, `st_ativo`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `version`) as the Prisma convention applied to every model in `database/migrations/README.md`
- [X] T009 [P] Implement a Prisma Client extension that intercepts `.delete()`/`.deleteMany()` and rejects them (or redirects to a soft-delete update setting `deleted_at`/`st_ativo`) in `apps/api/src/common/prisma/soft-delete.extension.ts`, so "delete físico é proibido" (constitution) is technically enforced, not just documented (depends on T007)
- [X] T010 [P] Create `Workflow`, `WorkflowStage`, `WorkflowTransition` Prisma models + migration in `apps/api/prisma/schema.prisma` (spec FR-004/FR-005 — the data-driven workflow engine every demand's `status` moves through) (depends on T007)
- [X] T011 [P] Create `Provider`, `ProviderConfiguration` Prisma models + migration in `apps/api/prisma/schema.prisma` (spec FR-008 — per-project, per-pipeline-stage provider configuration; backs the `LLMProvider`/`DemandProvider`/etc. selection used from Phase 4 onward) (depends on T007)
- [X] T012 [P] Create `User`, `Role`, `Permission`, `UserRole`, `RolePermission` Prisma models in `apps/api/prisma/schema.prisma` (depends on T007)
- [X] T013 Create the initial Prisma migration and `apps/api/prisma/seed.ts` seeding a default admin `User`/`Role`/`Permission` set, the default `WorkflowStage` sequence (NEW→...→PULL_REQUEST plus BLOCKED/FAILED/CANCELLED), and the `Provider` catalog rows (monday, github, chatgpt, claude, speckit, minio) (depends on T007, T010, T011, T012) — migration itself still needs a running Postgres to be generated (`prisma migrate dev`), see report
- [X] T014 [P] Implement Passport OAuth2/OIDC strategy + JWT/refresh-token module in `apps/api/src/modules/identity/auth/`
- [X] T015 [P] Implement the RBAC Guard in `apps/api/src/modules/identity/guards/rbac.guard.ts`
- [X] T016 [P] Configure rate limiting via `@nestjs/throttler` in `apps/api/src/app.module.ts`
- [X] T017 [P] Implement the audit interceptor writing `AuditLog` rows in `apps/api/src/common/interceptors/audit.interceptor.ts`
- [X] T018 [P] Configure pino structured logging in `apps/api/src/common/logging/`
- [X] T019 [P] Implement the env-schema loader in `packages/config/src/index.ts`
- [X] T020 [P] Declare the Provider interfaces (`DemandProvider`, `CodeRepositoryProvider`, `LLMProvider`, `SDDProvider`, `StorageProvider`) in `packages/domain/src/providers/`
- [X] T021 Implement the BullMQ/Redis connection module in `apps/api/src/common/queue/` and create the `Clients` + `Projects` NestJS modules (models/controllers/services) in `apps/api/src/modules/{clients,projects}/`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Demand intake and tracking (Priority: P1) 🎯 MVP

**Goal**: A demand from an external source enters the platform as a trackable record with
client/project/type/status/history visible.

**Independent Test**: Import a demand, confirm it appears with all required fields; re-import
the same external id and confirm it is rejected rather than duplicated or silently updated.

- [X] T022 [P] [US1] Create `Demand` Prisma model + migration in `apps/api/prisma/schema.prisma`
- [X] T023 [P] [US1] Implement `MondayDemandProvider` adapter (`DemandProvider`) in `packages/infrastructure/src/providers/monday-demand.provider.ts`
- [X] T024 [US1] Implement the Demands module (list/create/get/patch) per `contracts/demands.md` in `apps/api/src/modules/demands/` (depends on T022)
- [X] T025 [US1] Enforce `(origin, external_id)` uniqueness, returning 409 on re-import, in `apps/api/src/modules/demands/demands.service.ts` (spec FR-028)
- [X] T026 [US1] Implement `GET /api/v1/demands/:id/timeline` querying `AuditLog` in `apps/api/src/modules/demands/demands.controller.ts`
- [X] T027 [US1] Wire demand creation/update through the audit interceptor and `DemandProvider` abstraction end-to-end
- [X] T028 [US1] Validate `quickstart.md` step 3 (import demand → 201; duplicate import → 409; history visible) — **validated live** against a real Postgres (Supabase, isolated `software_factory` schema): `POST /demands` → 201 with all fields; re-POST same `(origin, external_id)` → 409 with the exact FR-028 message; `GET /demands/:id/timeline` returned the real AuditLog entry with actor/before/after/correlationId.

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Specification pipeline (Priority: P1)

**Goal**: A demand moves through Specify → Clarify → Plan → Checklist → Tasks → Analyze, each
stage producing an attributed document and advancing the demand's stage.

**Independent Test**: Run each SDD stage in order for a demand and confirm each produces its
document, attributed to user/agent/LLM/execution, with the demand's stage advancing.

- [X] T029 [P] [US2] Create `Agent`, `AgentExecution`, `Specification`, `SpecificationVersion` Prisma models + migration in `apps/api/prisma/schema.prisma`
- [X] T030 [P] [US2] Implement `SpecKitProvider` adapter (`SDDProvider`) in `packages/infrastructure/src/providers/speckit.provider.ts`
- [X] T031 [P] [US2] Implement `ChatGPTProvider` adapter (`LLMProvider`) in `packages/infrastructure/src/providers/chatgpt.provider.ts`
- [X] T032 [P] [US2] Implement `ClaudeProvider` adapter (`LLMProvider`) in `packages/infrastructure/src/providers/claude.provider.ts`
- [X] T033 [US2] Implement the Executions module `POST /api/v1/executions` (enqueues a BullMQ job, resolving the `ProviderConfiguration` for the requested pipeline stage) in `apps/api/src/modules/executions/` (depends on T011, T029-T032)
- [X] T034 [US2] Implement the BullMQ worker processor that runs the selected Agent/LLMProvider and writes a `SpecificationVersion` in `apps/api/src/modules/executions/executions.processor.ts`
- [X] T035 [US2] Implement `WorkflowTransition`-driven `Demand.status` advancement in `apps/api/src/modules/workflows/workflows.service.ts` (spec FR-004/FR-005, depends on T010)
- [X] T036 [US2] Implement `GET /api/v1/executions`, `retry`, and `cancel` endpoints in `apps/api/src/modules/executions/executions.controller.ts`
- [ ] T037 [US2] Validate `quickstart.md` step 4 (Specify→Analyze sequence; demand status advances; each document tracked) — **blocked in this environment** (no Docker/Postgres/Redis); code type-checks and lints cleanly.

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Specification versioning and review (Priority: P1)

**Goal**: Editing a specification always creates a new version; any version can be compared
or restored without losing history.

**Independent Test**: Edit and save a specification, confirm a new version exists with the
prior one intact; restore the prior version and confirm it becomes current without deleting
history.

- [X] T038 [P] [US3] Implement `POST /api/v1/specifications/:id/versions` (never overwrites — spec FR-010) in `apps/api/src/modules/specifications/specifications.service.ts`
- [X] T039 [P] [US3] Implement `GET /api/v1/specifications/:id/versions` list endpoint in `apps/api/src/modules/specifications/specifications.controller.ts`
- [X] T040 [US3] Implement `GET /api/v1/specifications/:id/versions/:a/diff/:b` in `apps/api/src/modules/specifications/specifications.service.ts` (depends on T038)
- [X] T041 [US3] Implement `POST /api/v1/specifications/:id/versions/:versionId/restore`, creating a new version that copies the restored content (spec FR-011), in `apps/api/src/modules/specifications/specifications.service.ts`
- [ ] T042 [US3] Validate `quickstart.md` step 5 (edit → 2 versions → restore → 3rd version, original intact) — **blocked in this environment** (no Docker/Postgres); code type-checks cleanly.

**Checkpoint**: User Stories 1–3 all work independently

---

## Phase 6: User Story 4 - Artifact identification and workspace creation (Priority: P1)

**Goal**: An approved plan produces an isolated workspace (`spec/` + `artefatos/` only) and a
list of identified artifacts with their expected files.

**Independent Test**: Approve a demand's plan, confirm the workspace contains exactly the two
areas, and each artifact appears with type/technology/expected files.

- [X] T043 [P] [US4] Create `Artifact`, `ArtifactFile`, `ArtifactRepository` (N:N), `DemandWorkspace` Prisma models + migration in `apps/api/prisma/schema.prisma`
- [X] T044 [US4] Implement the workspace-creation service materializing `workspace/<ticket>-<slug>/{spec,artefatos}/` on disk in `apps/api/src/modules/workspaces/workspaces.service.ts` (spec FR-013/FR-014, depends on T043)
- [X] T045 [US4] Implement the Artifacts module (`POST`/`GET /api/v1/demands/:id/artifacts`, `GET`/`PATCH /api/v1/artifacts/:id`) in `apps/api/src/modules/artifacts/`
- [X] T046 [US4] Implement `POST /api/v1/artifacts/:id/files` with the `DISCOVERED`-requires-`reason` validation (spec FR-017) in `apps/api/src/modules/artifacts/artifacts.service.ts`
- [X] T047 [US4] Implement `GET /api/v1/workspaces/:id/tree` and `/files` endpoints in `apps/api/src/modules/workspaces/workspaces.controller.ts`
- [X] T048 [US4] Implement `GET /api/v1/artifacts/:id/versions` in `apps/api/src/modules/artifacts/artifacts.controller.ts`
- [X] T049 [US4] Validate `quickstart.md` step 6 (artifacts identified; workspace created with exactly `spec/` + `artefatos/`) — **validated live**: `POST /demands/:id/workspace` created `workspace/E2E-2-segunda-demanda/{spec,artefatos}/` on disk for real, exactly the two required directories. Found and fixed a real bug in the process: the workspace-root path was computed from `process.cwd()`, which put workspaces outside the repo entirely when the API was launched from the monorepo root; now resolved relative to `__dirname` instead.

**Checkpoint**: User Stories 1–4 all work independently

---

## Phase 7: User Story 5 - Demand cockpit (Priority: P1)

**Goal**: A single view per demand shows workflow progress, workspace, artifacts,
specifications, and a chronological timeline.

**Independent Test**: Open the cockpit for a demand that progressed through several stages
and confirm workflow, workspace, artifacts, specifications, and timeline are all present and
consistent.

- [X] T050 [P] [US5] Implement `GET /api/v1/demands/:id/workflow` read model in `apps/api/src/modules/demands/demands.controller.ts`
- [X] T051 [P] [US5] Implement `GET /api/v1/demands/:id/specifications` and `/artifacts` list endpoints in `apps/api/src/modules/demands/demands.controller.ts`
- [X] T052 [US5] Implement a 2-second TanStack Query polling hook in `apps/web/src/services/useDemandPolling.ts` (research.md §5 / plan.md SC-008)
- [X] T053 [P] [US5] Build the `WorkflowProgress` component in `apps/web/src/components/WorkflowProgress.tsx`
- [X] T054 [P] [US5] Build the `WorkspaceTree` and `ArtifactList` components in `apps/web/src/components/`
- [X] T055 [P] [US5] Build the `SpecificationList` and `Timeline` components in `apps/web/src/components/`
- [X] T056 [US5] Compose the `DemandCockpit` page in `apps/web/src/pages/DemandCockpit.tsx` (depends on T052-T055)
- [ ] T057 [US5] Validate `quickstart.md` step 7 and the full P1 MVP flow end-to-end — **blocked in this environment** (no Docker/Postgres/Redis to run `apps/api` + `apps/web` live); all code across Phases 1–7 type-checks and lints cleanly.

**Checkpoint**: All P1 user stories (1–5) work independently and together — this is the MVP boundary

---

## Phase 8: User Story 6 - Automated implementation (Priority: P2)

**Goal**: The Developer Agent implements a demand's planned changes within its artifacts'
expected files, registering any discovered out-of-scope file with a justification.

**Independent Test**: Provide the Developer Agent an approved demand and confirm it changes
the expected files, registering any additional file as `DISCOVERED` with a reason.

- [X] T058 [P] [US6] Create `Repository`, `Branch` Prisma models + migration in `apps/api/prisma/schema.prisma`
- [X] T059 [P] [US6] Implement the `GitHubRepositoryProvider` adapter (`getRepository`/`cloneRepository`/`createBranch`/`getFile`/`searchCode`) in `packages/infrastructure/src/providers/github-repository.provider.ts` — implemented the full `CodeRepositoryProvider` interface here (including the commit/push/PR methods originally scoped to T070) since it's one cohesive adapter class
- [X] T060 [US6] Register `DeveloperAgent` as a new `Agent` row and extend the Phase 4 execution pipeline to run it in `apps/api/prisma/seed.ts` and `apps/api/src/modules/executions/executions.processor.ts`
- [X] T061 [US6] Implement branch creation that reuses one branch per repository across artifacts in `apps/api/src/modules/executions/developer-agent.service.ts` (spec Edge Cases)
- [X] T062 [US6] Implement the implementation worker writing `ArtifactFile` rows (including `DISCOVERED` with justification) in `apps/api/src/modules/executions/developer-agent.service.ts` (depends on T046, T061) — known simplification noted in code: files are attributed to the demand's first artifact since `SDDProvider.implement()` doesn't yet report results per-artifact
- [ ] T063 [US6] Validate: run the Developer Agent against a demand with two artifacts sharing a repository; confirm one branch and correct `ArtifactFile` records — **blocked in this environment** (no Docker/Postgres/GitHub credentials); code type-checks and lints cleanly.

**Checkpoint**: User Story 6 works independently on top of the P1 foundation

---

## Phase 9: User Story 7 - Automated testing and Test Gate (Priority: P2)

**Goal**: Required tests run after implementation; a failing required test blocks the commit.

**Independent Test**: Run required tests with a deliberate failure present and confirm no
commit occurs; fix the failure, re-run, and confirm the commit is allowed.

- [X] T064 [P] [US7] Create `TestExecution`, `TestResult` Prisma models + migration in `apps/api/prisma/schema.prisma`
- [X] T065 [US7] Implement the `TestRunner` service invoking `Project.required_test_suites` in `apps/api/src/modules/tests/test-runner.service.ts`
- [X] T066 [US7] Implement `POST /api/v1/demands/:id/tests/run` in `apps/api/src/modules/tests/tests.controller.ts` (also added `GET /demands/:id/tests` for symmetry with other resources)
- [X] T067 [US7] Implement the Test Gate check blocking commit with 422 + failing suite names in `apps/api/src/modules/git/git.service.ts` (spec FR-021, depends on T065)
- [ ] T068 [US7] Validate: a deliberately failing required test blocks the commit; fixing and re-running allows it to proceed — **blocked in this environment** (no Docker/Postgres); code type-checks and lints cleanly.

**Checkpoint**: User Story 7 works independently on top of Story 6

---

## Phase 10: User Story 8 - Commit, push, and Pull Request (Priority: P2)

**Goal**: After the Test Gate passes, the platform commits, pushes, and opens a Pull Request
pre-filled with the demand's context.

**Independent Test**: Take a demand that passed the Test Gate, let the platform commit, push,
and create the PR, and confirm it contains title/description/summary/artifacts/files/
tests/risks.

- [X] T069 [P] [US8] Create `Commit`, `PullRequest` Prisma models + migration in `apps/api/prisma/schema.prisma`
- [X] T070 [US8] Extend `GitHubRepositoryProvider` with `commit`/`push`/`createPullRequest`/`getPullRequest`/`getChecks` in `packages/infrastructure/src/providers/github-repository.provider.ts` (depends on T059) — already implemented alongside T059
- [X] T071 [US8] Implement `POST /api/v1/demands/:id/commit`, gated by the Test Gate and linking demand/artifact/task/test-execution, in `apps/api/src/modules/git/git.service.ts` (spec FR-022, depends on T067)
- [X] T072 [US8] Implement `POST /api/v1/demands/:id/pull-request` with auto-generated content in `apps/api/src/modules/git/git.service.ts` (spec FR-023)
- [X] T073 [US8] Implement `POST /api/v1/demands/:id/branch` endpoint in `apps/api/src/modules/git/git.controller.ts`, calling the same branch-creation logic as T061 via `DeveloperAgentService.ensureBranchesForDemand` (not a second independent implementation)
- [ ] T074 [US8] Validate: a demand that passes the Test Gate produces a commit/push/PR with all required content populated — **blocked in this environment** (no Docker/Postgres/GitHub credentials); code type-checks and lints cleanly.

**Checkpoint**: User Story 8 works independently on top of Story 7

---

## Phase 11: User Story 9 - Git activity tracking (Priority: P2)

**Goal**: Branch, commits, Pull Request, and checks are visible per demand.

**Independent Test**: After a demand has commits and an open PR, open its Git view and
confirm branch/commits/PR status/checks match the code host.

- [X] T075 [US9] Implement `GET /api/v1/demands/:id/git` read model in `apps/api/src/modules/git/git.controller.ts` — implemented alongside T071-T073 since it's the same controller
- [X] T076 [US9] Implement `GET /api/v1/pull-requests/:id` with live checks in `apps/api/src/modules/git/pull-requests.controller.ts`
- [X] T077 [US9] Build the `GitActivity` component and add it to the cockpit in `apps/web/src/components/GitActivity.tsx` and `apps/web/src/pages/DemandCockpit.tsx` (depends on T056)
- [ ] T078 [US9] Validate: a demand with commits and an open PR shows branch, commits, PR status, and checks matching the code host — **blocked in this environment** (no Docker/Postgres/GitHub credentials); code type-checks and lints cleanly.

**Checkpoint**: All user stories (P1 and P2) work independently and together

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T079 [P] Wire the CI pipeline (lint + unit + build gate) in `.github/workflows/ci.yml`
- [X] T080 [P] Write the repository `README.md` documenting setup and the module map
- [X] T081 [P] Add a secrets-in-code check (e.g. gitleaks) to CI, verifying no credential is ever committed
- [X] T082 Implement `GET /api/v1/demands/:id/trace` traceability read-model in `apps/api/src/modules/demands/demands.controller.ts` (spec FR-024)
- [X] T083 [P] Implement `GET /api/v1/audits` endpoint in `apps/api/src/modules/audit/audit.controller.ts`
- [ ] T084 Run the full `quickstart.md` end-to-end validation against the docker-compose environment — **partially validated live** (see Live-validation note above): P1's core flow (clients/projects/demands/workspace/audit/trace/auth) verified against a real Postgres; MinIO/Redis and the docker-compose path itself were not exercised (no Docker in this environment), and P2's external integrations (LLM, Spec Kit CLI, GitHub) need real credentials not available here. Remaining validation: run `docker compose up`, provide real `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GITHUB_TOKEN`, and exercise US2/US6-9.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–11)**: All depend on Foundational. Unlike a fully independent
  story set, this feature's stories have a natural build order:
  - P1 critical path: **US1 → US2 → US3 → US4 → US5** (US2 needs US1's `Demand`; US3 needs
    US2's `Specification`; US4 needs an approved plan produced by US2; US5's cockpit reads
    US1–4's endpoints).
  - P2 critical path: **US6 → US7 → US8 → US9** (US6 needs US1's `Demand` + US4's workspace/
    artifacts; US7 needs US6's implementation output; US8 needs US7's Test Gate; US9 needs
    US8's Git entities).
  - Each story is still independently testable once its prerequisites exist — "independent"
    here means it can be validated and demoed on its own, not that it can be built before its
    data dependencies exist.
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Within Each User Story

- Prisma model tasks before service/controller tasks
- Provider-adapter tasks before the module tasks that consume them
- Core implementation before the story's validation task

### Parallel Opportunities

- All Setup tasks marked `[P]` (T002–T005) can run in parallel
- Within Foundational, T008–T012 and T014–T020 (marked `[P]`) can run in parallel once T007 exists
- Within each user-story phase, `[P]`-marked model/adapter/component tasks can run in parallel; the module/controller/page task that composes them cannot start until they're done
- US1–US5 (P1) should be built in order per the critical path above; US6–US9 (P2) likewise

---

## Parallel Example: User Story 2

```bash
# Launch all provider-adapter tasks for User Story 2 together:
Task: "Implement SpecKitProvider adapter (SDDProvider) in packages/infrastructure/src/providers/speckit.provider.ts"
Task: "Implement ChatGPTProvider adapter (LLMProvider) in packages/infrastructure/src/providers/chatgpt.provider.ts"
Task: "Implement ClaudeProvider adapter (LLMProvider) in packages/infrastructure/src/providers/claude.provider.ts"

# Then the Executions module (T033) depends on all three, plus T011 (ProviderConfiguration).
```

---

## Implementation Strategy

### MVP First (User Stories 1–5, Phases 1–7)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phases 3–7 in order: US1 → US2 → US3 → US4 → US5
4. **STOP and VALIDATE**: run `quickstart.md` in full — this is the demoable MVP (no code
   changes yet, per spec.md's Assumptions)
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → US2 → US3 → US4 → US5, each validated against its `quickstart.md` step before
   moving to the next (MVP complete after US5)
3. US6 → US7 → US8 → US9, each validated against its own independent test before moving to
   the next (full P1+P2 scope complete after US9)
4. Final Phase: polish, CI, and a full end-to-end `quickstart.md` run

### Team Strategy

Because P1 and P2 each have a real build order (not full independence), parallelizing across
*people* works best within a phase (e.g., three developers picking up T029–T032 together)
rather than across stories — a second developer cannot meaningfully start US2 before US1's
`Demand` model and Demands module exist.

---

## Notes

- `[P]` tasks = different files, no dependencies
- `[Story]` label maps task to specific user story for traceability
- No dedicated test-writing tasks were generated (not requested in spec.md); each story ends
  with a validation task tied to its `quickstart.md` step or an equivalent independent test
  from spec.md's Acceptance Scenarios
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, skipping a story's data-model prerequisites
