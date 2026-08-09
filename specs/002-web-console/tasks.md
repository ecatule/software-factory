---

description: "Task list template for feature implementation"
---

# Tasks: Web Console — Administrative Screens

**Input**: Design documents from `/specs/002-web-console/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not explicitly requested in spec.md; each user story ends with a validation task
derived from `quickstart.md`, consistent with how `001-ai-software-factory` was built.

**Organization**: Tasks are grouped by user story (spec.md priorities: P1 = US1-5, P2 = US6-8,
P3 = US9-11, P4 = US12-13, P5 = US14-15).

**Independence note (differs from 001)**: User Story 1 (Sign in) is a hard prerequisite for
every other story (FR-001: no screen renders without auth). Beyond that single dependency,
US2-15 do **not** depend on each other — each only needs Foundational + US1 + whatever
001 backend endpoints it reuses. This is more parallelizable than `001-ai-software-factory`,
where every P1 story chained through shared data dependencies (Demand → Specification →
Artifact → Cockpit).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Extends the `001-ai-software-factory` monorepo: `apps/api/src/` (NestJS), `apps/web/src/`
(React), `packages/ui/src/` (shared presentational components — first real use in this
feature).

---

## Phase 1: Setup

- [X] T001 [P] Add `react-hook-form`, `@tanstack/react-table`, `react-markdown` to `apps/web/package.json`
- [X] T002 [P] Add `openid-client`, `cookie-parser`, `@types/cookie-parser` to `apps/api/package.json`
- [X] T003 Wire the `cookie-parser` middleware into `apps/api/src/main.ts` (also enabled CORS with credentials for the SPA origin, needed for the httpOnly refresh cookie)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create the `DataTable` component in `packages/ui/src/DataTable.tsx`
- [X] T005 [P] Create the `Pagination` component in `packages/ui/src/Pagination.tsx`
- [X] T006 [P] Create the `FormField` component in `packages/ui/src/FormField.tsx`
- [X] T007 [P] Create the `Modal` component in `packages/ui/src/Modal.tsx`
- [X] T008 [P] Create the `Badge` component in `packages/ui/src/Badge.tsx`
- [X] T009 Create the shared `PaginationQueryDto` + a `paginate()` Prisma helper (the `{items,total,page,page_size}` envelope from data-model.md) in `apps/api/src/common/pagination/`
- [X] T010 Create the base `NavShell` component (built with the full 15-item nav list up front rather than growing it story-by-story, since the implementer already knows every screen's route) in `apps/web/src/components/NavShell.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Sign in to the console (Priority: P1) 🎯 MVP

**Goal**: A user signs in via OIDC and every subsequent screen is gated on that session.

**Independent Test**: Open the console signed out, confirm redirect to sign-in; sign in with
valid credentials and reach the console; confirm an expired session returns to sign-in.

- [X] T011 [P] [US1] Implement `OidcService` (`openid-client` wrapper: authorization URL + PKCE, code exchange) in `apps/api/src/modules/identity/auth/oidc.service.ts` — discovery is lazy (not on module boot) so the API still starts without an IdP configured
- [X] T012 [US1] Implement `GET /auth/login` in `apps/api/src/modules/identity/auth/auth.controller.ts` (depends on T011)
- [X] T013 [US1] Implement `GET /auth/callback` (code exchange, set httpOnly refresh cookie, redirect to SPA) in `apps/api/src/modules/identity/auth/auth.controller.ts` (depends on T011)
- [X] T014 [US1] Implement `GET /auth/session` (mint a fresh access token from the refresh cookie) in `apps/api/src/modules/identity/auth/auth.controller.ts`
- [X] T015 [US1] Implement `POST /auth/logout` (clear the refresh cookie) in `apps/api/src/modules/identity/auth/auth.controller.ts`
- [X] T016 [P] [US1] Implement `AuthContext` (session state, sign-in/out, silent refresh via `GET /auth/session`) in `apps/web/src/context/AuthContext.tsx`
- [X] T017 [US1] Implement the `ProtectedRoute` wrapper in `apps/web/src/routes/ProtectedRoute.tsx` (depends on T016)
- [X] T018 [US1] Implement the `Login` page in `apps/web/src/pages/Login.tsx` (depends on T016)
- [X] T019 [US1] Wire `AuthContext` + `ProtectedRoute` into `apps/web/src/App.tsx`'s router (depends on T017, T018)
- [ ] T020 [US1] Validate `quickstart.md` step 1 (sign in via OIDC; land on the Dashboard within 2 clicks; expired session returns to sign-in) — **blocked in this environment** (no OIDC identity provider configured, no Docker); code type-checks cleanly across `apps/api` and `apps/web`.

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Dashboard overview (Priority: P1)

**Goal**: A signed-in user sees a high-level picture of the platform on landing.

**Independent Test**: With demands in several stages, open the dashboard and confirm counts
and the recent-demands list reflect real platform state.

- [X] T021 [P] [US2] Create the `DashboardModule` with `GET /dashboard/summary` (stage counts + recent demands, contracts/dashboard.md) in `apps/api/src/modules/dashboard/`
- [X] T022 [US2] Implement `useDashboardSummary` hook in `apps/web/src/services/useDashboardSummary.ts` (depends on T021)
- [X] T023 [US2] Implement the `Dashboard` page in `apps/web/src/pages/Dashboard.tsx` (depends on T022)
- [X] T024 [US2] Register the Dashboard route and `NavShell` entry in `apps/web/src/App.tsx` and `NavShell.tsx`
- [ ] T025 [US2] Validate `quickstart.md` step 2 (stage counts and recent demands match `GET /dashboard/summary`; clicking a demand opens its cockpit) — pending live validation alongside T020

**Checkpoint**: User Stories 1-2 work independently

---

## Phase 5: User Story 3 - Manage Clients (Priority: P1)

**Goal**: List, create, and edit Clients through the console.

**Independent Test**: Create a client, confirm it appears in the list, edit its name, confirm
the update is reflected without a reload.

- [X] T026 [P] [US3] Implement `useClientsList`/`useCreateClient`/`useUpdateClient` hooks (against 001's existing `/clients` endpoints) in `apps/web/src/services/useClients.ts`
- [X] T027 [US3] Implement the `Clients` page (list + create/edit form, using the Phase 2 `DataTable`/`FormField`) in `apps/web/src/pages/Clients.tsx` (depends on T026)
- [X] T028 [US3] Register the Clients route and nav entry
- [ ] T029 [US3] Validate: create, list, and edit a client through the console — pending live validation

**Checkpoint**: User Stories 1-3 work independently

---

## Phase 6: User Story 4 - Manage Projects (Priority: P1)

**Goal**: List (filterable by client), create, and edit Projects, including required test
suites and branch naming policy.

**Independent Test**: Create a project under an existing client; confirm it's filtered
correctly and its required test suites are saved and displayed.

- [X] T030 [P] [US4] Implement `useProjectsList`/`useCreateProject`/`useUpdateProject` hooks (against 001's existing `/projects` endpoints, extended with a `client_id` filter — see below) in `apps/web/src/services/useProjects.ts`
- [X] T031 [US4] Implement the `Projects` page (client filter, required-test-suites field) in `apps/web/src/pages/Projects.tsx` (depends on T030) — also extended `GET /projects` with a `client_id` query filter in `apps/api/src/modules/projects/` (001 never had one; needed for FR-009)
- [X] T032 [US4] Register the Projects route and nav entry
- [ ] T033 [US4] Validate: create a project under a client; edit and save its required test suites — pending live validation

**Checkpoint**: User Stories 1-4 work independently

---

## Phase 7: User Story 5 - List and create Demands (Priority: P1)

**Goal**: Browse demands with filters and create one by hand.

**Independent Test**: Filter the demand list by status; create a demand and confirm it opens
its cockpit; re-create the same external id and confirm the 409 is shown clearly.

- [X] T034 [P] [US5] Implement `useDemandsList`/`useCreateDemand` hooks (paginated; filters client/project/status/type; against 001's existing paginated `GET/POST /demands`) in `apps/web/src/services/useDemands.ts`
- [X] T035 [US5] Implement the `Demands` page (list + create form; surface the FR-028 409 rejection clearly via `ApiError`, not a raw error) in `apps/web/src/pages/Demands.tsx` (depends on T034)
- [X] T036 [US5] Link each demand row to the existing `DemandCockpit` route (FR-012 — no duplicate detail view) in `apps/web/src/pages/Demands.tsx`
- [X] T037 [US5] Register the Demands route and nav entry
- [ ] T038 [US5] Validate `quickstart.md` steps 3-4 (Client→Project→Demand entirely via console in <3 min; all 15 screens reachable from nav; non-admin doesn't see Settings) — pending live validation; `tsc --noEmit` and `eslint` are clean across `apps/api`, `apps/web`, and `packages/ui` for the whole MVP tier (US1-US5)

**Checkpoint**: All P1 user stories (1-5) work independently and together — this is the MVP boundary

---

## Phase 8: User Story 6 - Browse Workspaces (Priority: P2)

**Goal**: Browse demand workspaces across the platform, not just from within one demand.

**Independent Test**: Open the Workspaces screen; confirm workspaces from multiple demands
are listed; opening one shows the same `spec/`+`artefatos/` tree as the demand cockpit.

- [X] T039 [P] [US6] Implement `GET /workspaces` list endpoint (contracts/console-lists.md, uses the Phase 2 pagination helper) in `apps/api/src/modules/workspaces/workspaces.service.ts` and `workspaces.controller.ts`
- [X] T040 [US6] Implement `useWorkspacesList` hook in `apps/web/src/services/useWorkspaces.ts` (depends on T039)
- [X] T041 [US6] Implement the `Workspaces` page (list + open the existing tree/file view) in `apps/web/src/pages/Workspaces.tsx` (depends on T040)
- [X] T042 [US6] Register the Workspaces route and nav entry
- [ ] T043 [US6] Validate: workspaces from multiple demands listed; opening one shows its file tree — pending live validation; `tsc --noEmit` clean

**Checkpoint**: User Story 6 works independently on top of the P1 foundation

---

## Phase 9: User Story 7 - Browse Artifacts (Priority: P2)

**Goal**: Browse artifacts across demands with type/technology/status and file detail.

**Independent Test**: Open the Artifacts screen; confirm artifacts from multiple demands are
listed; opening one shows its files, including `DISCOVERED` ones with their justification.

- [X] T044 [P] [US7] Implement `GET /artifacts` list endpoint (contracts/console-lists.md) in `apps/api/src/modules/artifacts/artifacts.service.ts` and `artifacts.controller.ts`
- [X] T045 [US7] Implement `useArtifactsList` hook in `apps/web/src/services/useArtifacts.ts` (depends on T044)
- [X] T046 [US7] Implement the `Artifacts` page (list + file detail incl. `DISCOVERED` justification, per spec FR-017/001 FR-017) in `apps/web/src/pages/Artifacts.tsx` (depends on T045)
- [X] T047 [US7] Register the Artifacts route and nav entry
- [ ] T048 [US7] Validate: artifacts across demands listed with type/technology/status; discovered-file justification visible — pending live validation

**Checkpoint**: User Stories 6-7 work independently

---

## Phase 10: User Story 8 - Edit and version Specifications (Priority: P2)

**Goal**: A Markdown editor that saves new versions, shows history, diffs, and restores.

**Independent Test**: Edit and save a specification; confirm a new version with the prior one
intact; compare two versions; restore an older one without losing the version in between.

- [X] T049 [P] [US8] Implement the `MarkdownEditor` component (textarea + `react-markdown` preview) in `packages/ui/src/MarkdownEditor.tsx` — also added `lib: ["ES2022","DOM","DOM.Iterable"]` to `packages/ui/tsconfig.json` (the base tsconfig has no DOM lib; needed for `HTMLTextAreaElement` event typing)
- [X] T050 [P] [US8] Implement the `DiffView` component (renders `{additions,deletions}`) in `packages/ui/src/DiffView.tsx`
- [X] T051 [US8] Implement `useSpecificationVersions` hooks (list/create/diff/restore, against 001's existing endpoints) in `apps/web/src/services/useSpecificationVersions.ts`
- [X] T052 [US8] Implement the `SpecificationEditor` page in `apps/web/src/pages/SpecificationEditor.tsx` (depends on T049, T050, T051)
- [X] T053 [US8] Add an "open in editor" link from the existing `SpecificationList` cockpit component in `apps/web/src/components/SpecificationList.tsx`
- [ ] T054 [US8] Validate `quickstart.md` step 5 (edit→save→new version; history intact; diff shown; restore doesn't lose the intervening version) — pending live validation; `tsc --noEmit` clean

**Checkpoint**: User Story 8 works independently

---

## Phase 11: User Story 9 - Manage Agents and trigger Executions (Priority: P3)

**Goal**: List the Agent catalog and trigger/retry/cancel executions for a demand.

**Independent Test**: Trigger an execution for a demand; confirm QUEUED→RUNNING→terminal
status; retry a failed execution and confirm a new linked execution is created.

- [X] T055 [P] [US9] Implement `GET /agents` list endpoint (new small module — gap found during task planning, not in the original endpoint inventory) in `apps/api/src/modules/agents/`
- [X] T056 [US9] Implement `useAgentsList` hook in `apps/web/src/services/useAgents.ts` (depends on T055)
- [X] T057 [US9] Implement the `Agents` page (list + trigger-execution form posting to 001's existing `POST /executions`) in `apps/web/src/pages/Agents.tsx` (depends on T056)
- [X] T058 [US9] Register the Agents route and nav entry
- [ ] T059 [US9] Validate: trigger, retry, and cancel an execution from the Agents screen; status transitions visible — pending live validation (also requires Redis, not available in this environment)

**Checkpoint**: User Story 9 works independently

---

## Phase 12: User Story 10 - Monitor Executions (Priority: P3)

**Goal**: Cross-platform execution list, filterable by demand/agent/status.

**Independent Test**: Filter by `status=FAILED`; confirm only failed executions are shown,
each with its error message visible.

- [X] T060 [P] [US10] Add pagination to `GET /executions` (contracts/console-lists.md — extends the existing endpoint) in `apps/api/src/modules/executions/executions.controller.ts` and `executions.service.ts`
- [X] T061 [US10] Implement `useExecutionsList` hook (paginated, filterable) in `apps/web/src/services/useExecutions.ts` (depends on T060)
- [X] T062 [US10] Implement the `Executions` page (list + error/input/output detail view) in `apps/web/src/pages/Executions.tsx` (depends on T061)
- [X] T063 [US10] Register the Executions route and nav entry
- [ ] T064 [US10] Validate: filter by status; open a failed execution's detail and confirm the error message is visible — pending live validation

**Checkpoint**: User Stories 9-10 work independently

---

## Phase 13: User Story 11 - View Test results (Priority: P3)

**Goal**: View a demand's test suite results and trigger a new run.

**Independent Test**: Trigger a test run with a failing suite; confirm the Tests screen shows
the failure distinctly, with pass/fail/skip counts.

- [X] T065 [P] [US11] Implement `useDemandTests` hook (against 001's existing `GET/POST /demands/:id/tests(/run)`) in `apps/web/src/services/useDemandTests.ts`
- [X] T066 [US11] Implement the `Tests` page, with a demand picker (reuses `useDemandsList`) since results are per-demand, not cross-demand (per spec.md) in `apps/web/src/pages/Tests.tsx` (depends on T065)
- [X] T067 [US11] Register the Tests route and nav entry
- [ ] T068 [US11] Validate: run tests for a demand with a failing suite; confirm the failing suite and its output are visible — pending live validation

**Checkpoint**: User Story 11 works independently

---

## Phase 14: User Story 12 - Browse Repositories (Priority: P4)

**Goal**: List repositories across projects and the artifacts referencing each.

**Independent Test**: Open the Repositories screen; confirm each shows its project and
reference; opening one lists the artifacts linked to it.

- [X] T069 [P] [US12] Create the `RepositoriesModule` (`GET /repositories`, `GET /repositories/:id`, `GET /repositories/:id/artifacts`, contracts/console-lists.md) in `apps/api/src/modules/repositories/`
- [X] T070 [US12] Implement `useRepositoriesList` hook in `apps/web/src/services/useRepositories.ts` (depends on T069)
- [X] T071 [US12] Implement the `Repositories` page (list + linked-artifacts detail) in `apps/web/src/pages/Repositories.tsx` (depends on T070)
- [X] T072 [US12] Register the Repositories route and nav entry
- [ ] T073 [US12] Validate: repositories listed with project; opening one shows its linked artifacts (spec 001 FR-016's N:N relationship) — pending live validation

**Checkpoint**: User Story 12 works independently

---

## Phase 15: User Story 13 - View Git activity (Priority: P4)

**Goal**: Cross-demand view of branches, commits, and Pull Requests.

**Independent Test**: Open the Git activity screen; confirm branches/commits/PRs from
multiple demands are listed with links back to their demand; a PR's checks are shown.

- [X] T074 [P] [US13] Implement `GET /branches`, `GET /commits` list endpoints in `apps/api/src/modules/git/git-activity.controller.ts` (new controller in the existing git module) and extended `pull-requests.controller.ts` with `GET /pull-requests` (list) alongside its existing single-item `GET /pull-requests/:id`, rather than duplicating PR listing logic in two controllers
- [X] T075 [US13] Implement `useBranchesList`/`useCommitsList`/`usePullRequestsList` hooks in `apps/web/src/services/useGitActivity.ts` (depends on T074)
- [X] T076 [US13] Implement the `GitActivity` page (sections per resource, each row linking to its demand; PR detail shows live checks via 001's existing `GET /pull-requests/:id`) in `apps/web/src/pages/GitActivity.tsx` (depends on T075)
- [X] T077 [US13] Register the Git activity route and nav entry
- [ ] T078 [US13] Validate: branches/commits/PRs across demands listed and linked back correctly; a PR's checks are shown — pending live validation

**Checkpoint**: User Stories 12-13 work independently

---

## Phase 16: User Story 14 - Browse the Audit log (Priority: P5)

**Goal**: Search the audit log by entity type, entity, actor, and date range.

**Independent Test**: Perform a few actions, then search the audit log filtered by entity
type and a date range; confirm the corresponding entries appear with actor and timestamp.

- [X] T079 [P] [US14] Add pagination to `GET /audits` (contracts/console-lists.md — extends the existing endpoint) in `apps/api/src/modules/audit/audit.controller.ts`
- [X] T080 [US14] Implement `useAuditList` hook (paginated, filterable) in `apps/web/src/services/useAudit.ts` (depends on T079)
- [X] T081 [US14] Implement the `Audit` page in `apps/web/src/pages/Audit.tsx` (depends on T080)
- [X] T082 [US14] Register the Audit route and nav entry
- [ ] T083 [US14] Validate: filter by entity type and date range; confirm actor/action/before-after visible per entry — pending live validation

**Checkpoint**: User Story 14 works independently

---

## Phase 17: User Story 15 - Configure Providers (Settings) (Priority: P5)

**Goal**: List the Provider catalog and configure non-secret settings, admin-only.

**Independent Test**: Configure a project-specific LLM provider for a pipeline stage; confirm
it's saved; attempt to save a secret-looking value and confirm it's rejected.

- [X] T084 [P] [US15] Implement `providers.controller.ts` (`GET /providers`, `GET/POST /providers/:id/configurations` + the FR-031 secret-pattern rejection helper, contracts/settings.md) in `apps/api/src/modules/providers/`
- [X] T085 [US15] Implement `useProvidersList`/`useProviderConfigurations`/`useSaveProviderConfiguration` hooks in `apps/web/src/services/useProviders.ts` (depends on T084)
- [X] T086 [US15] Implement the `Settings` page in `apps/web/src/pages/Settings.tsx` (depends on T085) — deliberately exposes only named non-secret fields (project/stage/model), not a generic value box, per contracts/settings.md
- [X] T087 [US15] Register the Settings route (RBAC-gated: `admin` role, both backend guard via `@Roles("admin")` on `ProvidersController` and frontend via `<ProtectedRoute roles={["admin"]}>` + `NavShell` visibility per FR-003) and nav entry
- [ ] T088 [US15] Validate `quickstart.md` step 6 (configure a project-scoped LLM provider for a stage; a secret-looking value is rejected with an explanation) — pending live validation; `tsc --noEmit` clean

**Checkpoint**: All 15 user stories work independently and together

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T089 [P] Update `README.md`'s module map with the new screens and endpoints
- [X] T090 [P] Review `.github/workflows/ci.yml` for any new lint/build targets needed — confirmed none needed; existing `pnpm -r lint`/`tsc --noEmit`/`build` scripts already cover the new modules/pages, and OIDC discovery is lazy so the build/boot doesn't require a real IdP
- [X] T091 Verify every new/extended list endpoint enforces its `page_size` cap server-side regardless of what a client requests (spec SC-007) — **found and fixed a real gap**: none of the controllers were actually capping `page_size` (each just parsed the query param and passed it straight through); fixed centrally in `apps/api/src/common/pagination/paginate.ts` (now clamps to 100 and defends `page`/`page_size` against non-positive/NaN input) so every call site — including 001's `GET /demands`, refactored to use the same helper — is covered by one fix
- [X] T092 Verify the Settings screen is unreachable for a non-admin session both ways: nav-hidden (FR-003) and API-rejected (RBAC guard), not just one or the other — **found and fixed a real bug during live validation**: `RbacGuard` was registered as a global `APP_GUARD` while `JwtAuthGuard` was only applied per-controller via `@UseGuards`; NestJS runs global guards before controller-level guards, so `RbacGuard` executed *before* `request.user` was ever populated — `ProvidersController` (`@Roles("admin")`) is the first controller in either feature to use `@Roles()`, so this ordering bug had never been exercised until now, and it broke access for admins too (`403 No authenticated user on request`), not just non-admins. Fixed by promoting `JwtAuthGuard` to a global `APP_GUARD` ordered before `RbacGuard` (`app.module.ts`), adding a `@Public()` decorator (`identity/auth/public.decorator.ts`) so `JwtAuthGuard` can skip authentication for `AuthController`'s own routes (login/callback/session/refresh/logout), and having `JwtAuthGuard` check that metadata via `Reflector` before delegating to `super.canActivate()`. Live-verified after the fix: admin token → 200 with the provider catalog; no-role token → `403 Requires one of roles [admin]`; no token → `401 Unauthorized`; `GET /auth/login` still reachable unauthenticated (redirects/fails only on the separate, expected "no OIDC provider configured" limitation)
- [ ] T093 Run the full `quickstart.md` end-to-end against a real OIDC provider and Postgres — **partially done**: MVP tier (dashboard/clients/projects/demands) live-verified against real Postgres (see README Status); RBAC-gated Settings/`ProvidersController` also live-verified (see T092); OIDC login itself and the remaining P2-P5 screen flows not live-verified (no OIDC provider/Redis/GitHub credentials in this environment)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — BLOCKS every other user story (FR-001:
  no screen renders without an authenticated session)
- **User Stories 2-15 (Phases 4-17)**: Each depends only on Foundational + User Story 1 (auth)
  and whichever 001 backend endpoints it reuses — **not on each other**. This is the key
  difference from `001-ai-software-factory`, where P1 stories chained through shared data
  (Demand → Specification → Artifact → Cockpit). Here, once sign-in works, Clients/Projects/
  Demands/Workspaces/Artifacts/Specifications/Agents/Executions/Tests/Repositories/Git
  activity/Audit/Settings can all be built in parallel by different people.
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Within Each User Story

- Backend endpoint(s) (if any) before the frontend hook
- Hook before the page component
- Page component before route/nav registration
- Route/nav registration before the story's validation task

### Parallel Opportunities

- All Setup tasks marked `[P]` (T001-T002) can run in parallel
- All Foundational tasks marked `[P]` (T004-T008) can run in parallel
- Once Foundational + US1 are done, **User Stories 2 through 15 can all proceed in parallel**
  (team capacity permitting) — a materially higher degree of parallelism than 001 had
- Within each story, the backend-endpoint task and any independent frontend primitive tasks
  marked `[P]` can run together; the page-composition task waits on its hook(s)

---

## Parallel Example: after User Story 1 lands

```bash
# With auth in place, these stories can all start at once (different people/sessions):
Task: "Implement useClientsList/useCreateClient/useUpdateClient hooks in apps/web/src/services/useClients.ts"          # US3
Task: "Implement GET /workspaces list endpoint in apps/api/src/modules/workspaces/"                                    # US6
Task: "Implement GET /agents list endpoint in apps/api/src/modules/agents/"                                            # US9
Task: "Create the RepositoriesModule in apps/api/src/modules/repositories/"                                            # US12
```

---

## Implementation Strategy

### MVP First (User Stories 1-5, Phases 1-7)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (sign-in) — unlocks every other story
4. Complete Phases 4-7: User Stories 2-5 (Dashboard, Clients, Projects, Demands) — can be
   parallelized across people once US1 is done, unlike 001's sequential P1 chain
5. **STOP and VALIDATE**: run `quickstart.md` steps 1-4 — this is the demoable MVP: a working
   console covering sign-in, dashboard, and the three core entities
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational + US1 → the platform to build every other screen on
2. US2-5 (P1 tier) → MVP console
3. US6-8 (P2), US9-11 (P3), US12-13 (P4), US14-15 (P5) → each addable independently and in
   any order once US1 exists, validated against its own `quickstart.md` step
4. Final Phase: polish, cross-cutting RBAC/pagination verification, full end-to-end run

### Team Strategy

Because only US1 is a hard prerequisite, this feature parallelizes well across a team: one
person on US1, then the rest split across US2-15 as capacity allows, each independently
testable and shippable.

---

## Notes

- `[P]` tasks = different files, no dependencies
- `[Story]` label maps task to specific user story for traceability
- No dedicated test-writing tasks were generated (not requested in spec.md); each story ends
  with a validation task tied to its `quickstart.md` step or an equivalent independent test
  from spec.md's Acceptance Scenarios
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, skipping a story's endpoint-before-hook-before-page order
