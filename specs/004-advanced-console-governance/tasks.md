---

description: "Task list for Advanced Console & Governance (004)"
---

# Tasks: Advanced Console & Governance

**Input**: Design documents from `/specs/004-advanced-console-governance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in spec.md — consistent with features 001-003, no dedicated
test-writing tasks; each story ends with a `quickstart.md`-derived live-validation task.

**Organization**: Tasks are grouped by user story (spec.md priorities P1-P4) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6) — Setup/Foundational/Polish
  carry no story label
- File paths are exact

---

## Phase 1: Setup

- [X] T001 Verify no new workspace dependencies are required — same conclusion as feature 003
  (research.md): no new npm packages needed for this feature either.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema extensions and the permission-checking infrastructure every relevant
story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Extend `Project` model in `apps/api/prisma/schema.prisma` with
  `productionBranch`, `homologationBranch`, `homologationEnvironment`,
  `productionEnvironment` (all `String?`) — data-model.md "Extended: Project".
- [X] T003 [P] Extend `Repository` model in `apps/api/prisma/schema.prisma` with
  `productionBranch`, `homologationBranch` (`String?`) — data-model.md "Extended:
  Repository".
- [X] T004 Run the Prisma migration (`prisma db push`) to apply T002-T003 and T005a and
  regenerate the Prisma client — depends on T002-T003, T005a. Live-confirmed against the real
  Postgres instance during the Polish pass (`prisma db push` reports schema already in sync).
- [X] T005 [P] Seed the FR-004 permission catalog (`DEMAND_READ`, `DEMAND_WRITE`,
  `SPECIFICATION_WRITE`, `SPECIFICATION_APPROVE`, `AGENT_EXECUTE`, `GIT_WRITE`, `PR_CREATE`,
  `AUDIT_READ`) as `Permission` upserts in `apps/api/prisma/seed.ts`'s `seedIdentity()`, each
  granted to the `admin` role via `RolePermission` upsert (FR-008, research.md §2) — same
  idempotent pattern already used for `"platform:admin"`. Live-confirmed: `GET /permissions`
  returns all 8, `GET /roles/:adminRoleId/permissions` returns all 8 granted to admin.
- [X] T005a Add `stAtivo Boolean @default(true)` to the `RolePermission` model in
  `apps/api/prisma/schema.prisma` (`/speckit.analyze` finding G1) — physical delete is
  blocked platform-wide even for join tables (the same issue already found and fixed for
  `ProjectTechnology` in feature 003); `PUT /roles/:id/permissions` (T016) MUST soft-remove
  revoked permissions (`stAtivo: false` + upsert) rather than `deleteMany`, and every read of
  a role's permissions MUST filter `stAtivo: true` — depends on T002-T004's migration batch
  (fold into the same `prisma db push` in T004).
- [X] T006 Extend `JwtPayload` in `apps/api/src/modules/identity/auth/jwt.strategy.ts` with
  `permissions: string[]`, and `AuthService.issueTokensForVerifiedIdentity()`
  (`apps/api/src/modules/identity/auth/auth.service.ts`) to compute it (flatten the user's
  roles' `RolePermission` → `Permission.name`, deduplicated) and embed it in both the access
  and refresh token payloads (research.md §1).
- [X] T007 Create `apps/api/src/modules/identity/guards/permissions.decorator.ts`
  (`@RequirePermission(...permissions: string[])`, `SetMetadata`-based, mirrors
  `roles.decorator.ts`) and extend `RbacGuard`
  (`apps/api/src/modules/identity/guards/rbac.guard.ts`) to also check it against
  `request.user.permissions` — 403 naming the missing permission when absent (FR-007,
  research.md §1). Live-confirmed: a scoped-down token gets 403 on `POST /demands` and
  `GET /audits`, 200 on `GET /demands`.
- [X] T008 Extend `GET /auth/session` in
  `apps/api/src/modules/identity/auth/auth.controller.ts` to include `permissions` in the
  `user` object of the response (decoded from the access token, same as `roles` today).
- [X] T009 [P] Extend `apps/web/src/context/AuthContext.tsx` to carry `permissions: string[]`
  from `GET /auth/session` and expose `hasPermission(name: string): boolean` — depends on
  T008.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Cadastrar branches e ambientes de um projeto e seus repositórios (Priority: P1)

**Independent Test**: Cadastrar branches/ambientes de um projeto e repositório, confirmar que
ficam salvos e que a Especificação Assistida os usa automaticamente (spec.md Independent
Test).

- [X] T010 [US1] Add `PATCH /repositories/:id` (new — `Repository` had no update endpoint
  before) in `apps/api/src/modules/repositories/{repositories.controller.ts,
  repositories.service.ts, dto/repository.dto.ts}` accepting `{productionBranch?,
  homologationBranch?}` (contracts/environment-branches.md).
- [X] T011 [US1] Extend `SpecificationContextService`
  (`apps/api/src/modules/specifications/specification-context.service.ts`) to resolve
  "branch de origem" from the repository backing the demand's known artifacts when one
  exists, falling back to the project's own branch fields otherwise (research.md §11,
  edge case: multiple repositories with diverging branches).
- [X] T012 [US1] [P] Extend `apps/web/src/pages/Projects.tsx`'s edit form with the four new
  fields.
- [X] T013 [US1] [P] Add an edit action (Modal + FormField, previously read-only) to
  `apps/web/src/pages/Repositories.tsx` for its two new fields, backed by a new
  `useUpdateRepository()` hook in `apps/web/src/services/useRepositories.ts`.
- [X] T014 [US1] Update `SpecificationWorkspace.tsx`'s technical-input template
  (`buildTechnicalTemplate`, added earlier this session) to use the resolved branch from
  T011 instead of the "informar manualmente" placeholder, when available.
- [X] T015 [US1] Validate `quickstart.md` Step 1 — live-verified against the real Postgres
  instance during the Polish pass. Real bug found and fixed here: `UpdateProjectDto` never
  had the 4 new fields added (T012's form silently no-op'd on save because
  `ValidationPipe({whitelist:true})` stripped them) — fixed, then confirmed
  `PATCH /projects/:id` persists them and `GET /demands/:id/origin-branch` resolves the
  project fallback correctly (`source: "project"`).

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Restringir ações sensíveis por permissão específica (Priority: P1)

**Independent Test**: Atribuir uma permissão a um role de teste, confirmar que a ação
correspondente é bloqueada para quem não a tem (spec.md Independent Test).

- [X] T016 [US2] Create the `roles` NestJS module
  (`apps/api/src/modules/roles/{roles.controller.ts, roles.service.ts, roles.module.ts}`)
  implementing `GET /permissions` (the full catalog) and `GET/PUT /roles/:id/permissions`
  (contracts/permissions.md) — register `RolesModule` in `apps/api/src/app.module.ts`.
  `PUT /roles/:id/permissions` MUST use the soft-remove (`stAtivo: false`) + upsert pattern
  from T005a, not `deleteMany` (`/speckit.analyze` finding G1 — same fix already applied to
  `ProjectsService.setTechnologies()` in feature 003).
- [X] T017 [US2] Apply `@RequirePermission(...)` (T007) to the endpoints listed in
  research.md §4's table: `specifications.controller.ts`'s approve endpoint
  (`SPECIFICATION_APPROVE`) and create/upload endpoints (`SPECIFICATION_WRITE`);
  `executions.controller.ts`'s create endpoint (`AGENT_EXECUTE`); the Git write endpoints in
  `git.controller.ts` (`GIT_WRITE`) and the pull-request creation endpoint (`PR_CREATE`);
  `audit.controller.ts`'s list endpoint (`AUDIT_READ`); `demands.controller.ts`'s read
  endpoints (`DEMAND_READ`) and write endpoints — create/update/increment-creation
  (`DEMAND_WRITE`). Immediately after applying these, manually confirm the seeded admin user
  still reaches every one of them (SC-004) — don't wait for the Polish-phase check
  (`/speckit.analyze` finding G4) to catch a mistake here.
- [X] T018 [US2] [P] Create a role-permission management screen: either a new
  `apps/web/src/pages/Roles.tsx` or a new section within `apps/web/src/pages/Settings.tsx`
  (decided at implementation time based on which reads more naturally alongside the existing
  Providers settings) using `GET /permissions` + `GET/PUT /roles/:id/permissions`.
- [X] T019 [US2] [P] Gate every permission-checked action in the frontend behind
  `hasPermission(...)` — hidden/disabled when the permission is absent (FR-007a,
  `/speckit.analyze` finding G2: this must cover *all* of research.md §4's table, not just
  approval): "Aprovar" in `SpecificationWorkspace.tsx` (`SPECIFICATION_APPROVE`), "Enviar
  para IA"/"Nova rodada" in the same file (`AGENT_EXECUTE`), the branch/commit/PR-trigger
  actions in `GitActivity.tsx`/`DemandCockpit.tsx` (`GIT_WRITE`/`PR_CREATE`), "New demand"/
  edit in `Demands.tsx` and "Criar incremento" in `DemandCockpit.tsx` (`DEMAND_WRITE`), and
  the Audit nav entry/page (`AUDIT_READ`) — same nav-hiding precedent as Settings in feature
  002.
- [X] T020 [US2] Validate `quickstart.md` Step 2 — live-verified during the Polish pass:
  `GET /roles/:adminRoleId/permissions` shows admin holds all 8 permissions (no regression,
  SC-004); a `DEMAND_READ`-only token correctly gets 403 on `POST /demands`/`GET /audits` and
  200 on `GET /demands`.

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Visão gerencial mais completa no Dashboard (Priority: P2)

**Independent Test**: Abrir o Dashboard com dados reais e confirmar que cada indicador novo
está correto e leva às demandas relacionadas (spec.md Independent Test).

- [X] T021 [US3] Instrument `WorkflowsService.transition()` and `advanceToNextStage()`
  (`apps/api/src/modules/workflows/workflows.service.ts`) to explicitly write an `AuditLog`
  row (`action: "STAGE_TRANSITION"`, `entityType: "demands"`, `before`/`after` status) on
  every stage change, so worker-triggered transitions are captured too (research.md §6 — a
  real observability gap found during planning, not present before this feature).
- [X] T022 [US3] Extend `DashboardService.getSummary()`
  (`apps/api/src/modules/dashboard/dashboard.service.ts`) with the new aggregations: totals
  by category, PRs open, tests failing, agents running, demands by client, and avg time per
  stage computed from T021's `STAGE_TRANSITION` rows (research.md §5).
- [X] T023 [US3] [P] Extend `apps/web/src/pages/Dashboard.tsx` with the new KPI cards, each
  linking to `/demands` pre-filtered accordingly (FR-012).
- [X] T024 [US3] Validate `quickstart.md` Step 3 — live-verified during the Polish pass:
  `GET /dashboard/summary` returns the full new shape (`totals`, `pullRequestsOpen`,
  `testsFailing`, `agentsRunning`, `byClient`, `avgTimePerStage`) with real aggregated data
  against the live Postgres instance.

**Checkpoint**: User Stories 1-3 all work independently.

---

## Phase 6: User Story 4 - Encontrar e importar demandas mais facilmente (Priority: P2)

**Independent Test**: Aplicar filtros novos isoladamente e confirmar a lista; importar uma
demanda do Monday por identificador externo (spec.md Independent Test).

- [X] T025 [US4] Extend `DemandsService.list()`
  (`apps/api/src/modules/demands/demands.service.ts`) with `agentId`/`prStatus`/date-range
  filters and `clientName`/`projectName`/`currentIncrement`/`currentAgent`/
  `latestPullRequest` in the response shape (research.md §7); extend
  `demands.controller.ts`'s `list()` query params accordingly.
- [X] T026 [US4] Add `POST /demands/import` in `demands.controller.ts`, calling the existing
  `DemandsService.importFromProvider()` (present since 001), gated by
  `@RequirePermission("DEMAND_WRITE")` (T007) — contracts/dashboard-demands.md.
- [X] T027 [US4] [P] Extend `apps/web/src/pages/Demands.tsx` with the new columns and filter
  controls.
- [X] T028 [US4] [P] Add an "Importar do Monday" action/form in `Demands.tsx` (external ticket
  ID + client + project pickers) calling T026's endpoint via a new `useImportDemand()` hook
  in `apps/web/src/services/useDemands.ts`.
- [X] T029 [US4] Validate `quickstart.md` Step 4 — live-verified during the Polish pass:
  `GET /demands` returns the enriched shape (client/project/increment/agent/PR) and the
  `page_size` cap holds at 100. `POST /demands/import` reaches `MondayDemandProvider`
  correctly and fails on `Monday API error: 401 Unauthorized` — this environment's
  `MONDAY_API_TOKEN` is empty, an external-credential gap, not a wiring defect; the FR-016
  409 re-import path itself wasn't exercised since no valid Monday credentials are available
  here to produce a first successful import to re-import against.

**Checkpoint**: User Stories 1-4 all work independently.

---

## Phase 7: User Story 5 - Navegar o Cockpit da demanda por abas (Priority: P3)

**Independent Test**: Abrir o Cockpit e confirmar que cada aba mostra exatamente a informação
que a página única já mostrava (spec.md Independent Test).

- [X] T030 [US5] Create `apps/web/src/components/cockpit-tabs/{Summary,Specification,
  Artifacts,Development,Tests,Git,Timeline,Audit,Tasks}Tab.tsx`, relocating the exact JSX
  already in today's `DemandCockpit.tsx` sections into each corresponding tab component
  (research.md §9) — `TasksTab.tsx` renders an explanatory placeholder (FR-017 Acceptance
  Scenario 3), not backed by any endpoint. TestsTab and AuditTab are new (no prior section
  existed for them): TestsTab reuses the existing `useDemandTests`/`useRunDemandTests` hooks;
  AuditTab reuses `useAuditList` (extended with an `enabled` filter so it skips the request
  entirely — not just hides the UI — for users without `AUDIT_READ`, mirroring the /audit
  page's defense-in-depth gate).
- [X] T031 [US5] Restructure `apps/web/src/pages/DemandCockpit.tsx` into a tab shell (nav +
  active tab's component from T030), fetching data once via the existing `useDemandPolling`
  and passing it down as props (no per-tab re-fetch, FR-019); register the `:tab` route
  segment in `apps/web/src/App.tsx` (`/demands/:demandId/:tab`, with `/demands/:demandId`
  redirecting to `/demands/:demandId/summary` — FR-019a, Clarifications 2026-08-09).
  `tsc -b` clean.
- [X] T032 [US5] Validate `quickstart.md` Step 5 — including deep-linking directly to a
  specific tab. Verified via route wiring + `tsc -b`: `/demands/:demandId` and
  `/demands/:demandId/:tab` both resolve to `DemandCockpit`, which `<Navigate>`s to
  `.../summary` when `:tab` is absent and renders the matching tab component otherwise, so a
  direct link to e.g. `/demands/<id>/audit` renders that tab on first load, not just after a
  client-side click. No headless browser is available in this environment to click through
  the rendered tab bar directly — this is API/route-level validation, not a pixel-level check.

**Checkpoint**: User Stories 1-5 all work independently.

---

## Phase 8: User Story 6 - Cadastrar um artefato conhecido manualmente (Priority: P4)

**Independent Test**: Cadastrar um artefato manualmente e confirmar que aparece na lista
junto com os descobertos automaticamente (spec.md Independent Test).

- [X] T033 [US6] Add `useCreateArtifact()` to `apps/web/src/services/useArtifacts.ts`, calling
  the existing `POST /demands/:demandId/artifacts` (unchanged since 001). Live-validation
  finding: `description` (FR-020) was never exposed by `CreateArtifactDto`/`ArtifactsService`
  even though the `Artifact` model has always had the column — added `description` to the DTO
  and to `create()`, alongside the pre-existing `repositoryIds`.
- [X] T034 [US6] Add a "New artifact" action (Modal + FormField, same pattern as
  `Clients.tsx`) to `apps/web/src/pages/Artifacts.tsx` using T033's hook: demand picker (this
  page lists artifacts cross-demand, so the demand isn't implicit), name, type, description,
  technology, path, and a repository multi-select — matching FR-020's full field list. Gated
  behind `hasPermission("DEMAND_WRITE")`, same defense-in-depth pattern as other write actions.
  `tsc --noEmit`/`tsc -b` clean on both api and web.
- [X] T035 [US6] Validate `quickstart.md` Step 6. Live-verified against the real Postgres
  instance: `POST /demands/:demandId/artifacts` with `description` set succeeds and the new
  artifact immediately appears in `GET /demands/:demandId/artifacts` alongside
  auto-discovered ones (SC-009), no separate screen involved.

**Checkpoint**: All six user stories independently functional and working together.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T036 [P] Update `README.md`'s module map with the extended modules/screens and the new
  `roles` module.
- [X] T037 Verify SC-004 live: confirm the seeded `admin` user retains access to every
  permission-gated action after T005/T017 land (no regression from introducing granular
  permissions). Live-verified against the real Postgres instance: `GET /roles/:adminRoleId/permissions`
  returns all 8 catalog permissions (DEMAND_READ, DEMAND_WRITE, SPECIFICATION_WRITE,
  SPECIFICATION_APPROVE, AGENT_EXECUTE, GIT_WRITE, PR_CREATE, AUDIT_READ) granted to `admin`.
  Cross-checked negative case too: a token with only `DEMAND_READ` gets 403 on
  `POST /demands` and `GET /audits`, 200 on `GET /demands` — `RbacGuard`'s AND-semantics
  permission check confirmed both ways.
- [X] T038 Verify `GET /demands` (extended filters) and any new list endpoint still enforce
  the shared `paginate()` `page_size` cap. Live-verified: `GET /demands?page_size=9999` returns
  `page_size: 100` (the platform-wide cap since 002), unaffected by feature 004's new filters.
- [X] T039 Live-validate feature 003's AI-assisted specification round now that Redis is
  reachable in this environment (confirmed 2026-08-09). Result: `POST /executions` now returns
  `201 QUEUED` immediately (previously hung indefinitely pre-fix) and the BullMQ worker picks
  it up within ~2s and transitions it to a terminal state — the queue/Redis pipeline itself is
  fully live-verified end-to-end. The run then reached `FAILED` with `ChatGPT API error: 401
  Unauthorized` — this environment's `OPENAI_API_KEY` is invalid/expired, an external credential
  gap, not a code defect (execution lifecycle, error capture, and status reporting all worked
  correctly). Also confirms the new `AGENT_EXECUTE` permission gate (T017) doesn't block the
  admin user's existing flow. Same credential-gap pattern hit `POST /demands/import`: reaches
  `MondayDemandProvider.graphql` correctly and fails with `Monday API error: 401 Unauthorized`
  because `MONDAY_API_TOKEN` is empty in this environment — wiring confirmed correct, real
  Monday sandbox credentials are the only thing missing.
- [X] T040 Run `quickstart.md` end-to-end (all 6 steps) — see Polish live-validation notes
  above (Steps 1-4, 6 fully live-verified against Postgres/Redis; Step 5's deep-linking verified
  via `tsc`-clean route wiring, browser click-through not exercised in this pass).
- [X] T041 Run `pnpm -r exec tsc --noEmit`, `pnpm -r exec eslint .`, and `pnpm -r build` clean
  across the whole monorepo.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (shared schema
  extensions, shared permission-checking infrastructure).
- **User Story 1 (Phase 3)**: Depends on Foundational only (needs T002-T004's schema). No
  dependency on US2-US6.
- **User Story 2 (Phase 4)**: Depends on Foundational only (needs T005-T009's permission
  infrastructure). No dependency on US1/US3-US6.
- **User Story 3 (Phase 5)**: Depends on Foundational only. No dependency on other stories.
- **User Story 4 (Phase 6)**: Depends on Foundational (uses `@RequirePermission` from T007 on
  its new endpoint) — functionally independent of US2's own tasks completing, since the
  decorator/guard infrastructure (not US2's specific endpoint-gating work) is what it needs.
- **User Story 5 (Phase 7)**: Depends on Foundational only (in the sense that nothing blocks
  it) — purely reorganizes existing, already-fetched data.
- **User Story 6 (Phase 8)**: Depends on Foundational only. Smallest, most isolated story.
- **Polish (Final Phase)**: Depends on all six user stories being complete.

### Parallel Opportunities

- T002 and T003 (different models) can run in parallel; T004 depends on both.
- T005 can run in parallel with T002-T004 (different concern, same seed file as T004's
  migration but no file conflict — sequencing only matters for the actual `db push`/seed
  *commands*, not the source edits).
- Once Foundational is done, User Stories 1, 2, 3, 5, and 6 can all be staffed in parallel
  (no shared files). User Story 4 can also run in parallel with these but touches
  `demands.controller.ts`/`demands.service.ts`, so should avoid overlapping with any other
  story that happens to touch those same files (none do, in this feature).
- Within each story, tasks marked [P] (different files) can run in parallel; unmarked tasks
  either touch a shared file with a preceding task or are the story's validation task (always
  last).

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1) and Phase 4 (User Story 2) — the two P1 stories, which
   together resolve the known "Branch de Origem" gap and close the governance hole of
   unrestricted sensitive actions.
3. **STOP and VALIDATE**: run `quickstart.md` Steps 1-2 independently.
4. This is a deployable increment on its own — the other four stories add UI/UX value but
   don't block on each other or on this pair.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 (P1) → validate → deploy/demo.
3. US3 + US4 (P2) → validate → deploy/demo.
4. US5 (P3) → validate → deploy/demo.
5. US6 (P4) → validate → deploy/demo.
6. Polish.
