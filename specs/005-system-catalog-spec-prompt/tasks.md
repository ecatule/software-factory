---

description: "Task list for Gestão de Sistemas, Artefatos e Especificação Assistida sem IA direta (005)"
---

# Tasks: Gestão de Sistemas, Artefatos e Especificação Assistida sem IA direta

**Input**: Design documents from `/specs/005-system-catalog-spec-prompt/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested in spec.md — consistent with features 001-004, no dedicated
test-writing tasks; each story ends with a `quickstart.md`-derived live-validation task.

**Organization**: Tasks are grouped by user story (spec.md priorities P1-P2) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US4) — Setup/Foundational/Polish
  carry no story label
- File paths are exact

---

## Phase 1: Setup

- [X] T001 Verify no new workspace dependencies are required — same conclusion as
  features 003/004 (research.md): no new npm packages needed for this feature either.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, seeded permissions, and module scaffolding every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add `System` model (`name`, `description?`, `stAtivo` + standard audit
  columns) to `apps/api/prisma/schema.prisma` — data-model.md "New: System".
- [X] T003 [P] Add `SystemArtifact` model (`systemId`, `name`, `type`, `technology?`,
  `description?`) to `apps/api/prisma/schema.prisma` — data-model.md "New: SystemArtifact".
- [X] T004 [P] Add `ClientSystem` model (`clientId`, `systemId`, `@@unique([clientId,
  systemId])`) to `apps/api/prisma/schema.prisma` — data-model.md "New: ClientSystem".
- [X] T005 [P] Add `DemandSystem` model (`demandId`, `systemId`, `@@unique([demandId,
  systemId])`) to `apps/api/prisma/schema.prisma` — data-model.md "New: DemandSystem".
- [X] T006 [P] Add `DemandSystemArtifact` model (`demandId`, `systemArtifactId`,
  `@@unique([demandId, systemArtifactId])`) to `apps/api/prisma/schema.prisma` —
  data-model.md "New: DemandSystemArtifact".
- [X] T007 Run the Prisma migration (`prisma db push`) to apply T002-T006 and regenerate
  the Prisma client — depends on T002-T006. Live-verified against the real Postgres
  instance (`prisma db push` → "in sync").
- [X] T008 [P] Seed the permission catalog additions (`SYSTEM_READ`, `SYSTEM_WRITE`,
  `SYSTEM_ARTIFACT_READ`, `SYSTEM_ARTIFACT_WRITE`, `DEMAND_SYSTEM_WRITE`,
  `SPEC_PROMPT_GENERATE`, research.md §3) as `Permission` upserts in
  `apps/api/prisma/seed.ts`'s `seedIdentity()`, each granted to the `admin` role via
  `RolePermission` upsert — same idempotent pattern already used for the feature 004
  catalog.
- [X] T009 [P] Copy `documentos iniciais/prompt-spec-kit.md` to
  `apps/api/prompts/prompt-spec-kit.md` (research.md §4 — versioned template location read
  by the backend at runtime, decoupled from the `documentos iniciais/` reference folder).
- [X] T010 Create the `systems` NestJS module skeleton
  (`apps/api/src/modules/systems/{systems.module.ts, systems.controller.ts,
  systems.service.ts, dto/system.dto.ts}`), register `SystemsModule` in
  `apps/api/src/app.module.ts` — mirrors the `roles`/`technologies` module pattern.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Cadastrar Sistemas e seus Artefatos (Priority: P1)

**Independent Test**: Cadastrar um Sistema, cadastrar um ou mais Artefatos dentro dele, e
confirmar que ambos aparecem na listagem — sem depender de nenhuma demanda ou cliente
(spec.md Independent Test).

- [X] T011 [US1] Implement `SystemsService` in `apps/api/src/modules/systems/
  systems.service.ts`: `list()`/`create()`/`update()` for `System`,
  `listArtifacts()`/`createArtifact()`/`updateArtifact()` for `SystemArtifact` — enforce
  FR-003 (reject creating an active `SystemArtifact` under an inactive `System`, 422).
  Implementation note: `AuditLog` rows are NOT written manually here — discovered a global
  `AuditInterceptor` (`apps/api/src/common/interceptors/audit.interceptor.ts`) already
  audits every POST/PUT/PATCH/DELETE HTTP request platform-wide (action=method,
  entityType inferred from the URL) — every contract in this feature that said "write an
  AuditLog row" is already satisfied by this for plain REST endpoints; manual writes are
  only needed for non-HTTP paths (T024, the Developer Agent).
- [X] T012 [US1] Implement `SystemsController` in `apps/api/src/modules/systems/
  systems.controller.ts`: `GET/POST /systems`, `PATCH /systems/:id`,
  `GET/POST /systems/:id/artifacts`, `PATCH /system-artifacts/:id` — `RequirePermission`
  per contracts/systems-artifacts.md, `paginate()` for the list endpoint (depends on T011).
  `tsc --noEmit` clean.
- [X] T013 [US1] [P] Create `apps/web/src/services/useSystems.ts`: `useSystemsList`,
  `useCreateSystem`, `useUpdateSystem`, `useSystemArtifacts`, `useCreateSystemArtifact`,
  `useUpdateSystemArtifact`. Also includes US2/US3's hooks (`useClientSystems`,
  `useSetClientSystems`, `useDemandSystems`, `useSetDemandSystems`,
  `useDemandSystemArtifacts`, `useSetDemandSystemArtifacts`) in the same file, since they
  share the `System`/`SystemArtifact` types — covers T019/T025 too.
- [X] T014 [US1] [P] Create `apps/web/src/pages/Systems.tsx`: Sistemas list (DataTable +
  create/edit Modal) with embedded Artefatos CRUD in the edit modal — same composition
  pattern as `Projects.tsx` + its `ProjectTechnologies` sub-component.
- [X] T015 [US1] Add a "Sistemas" nav entry in `apps/web/src/components/NavShell.tsx`
  (gated by `hasPermission("SYSTEM_READ")`, same pattern as the Audit entry) and register
  the `/systems` route in `apps/web/src/App.tsx`. `tsc -b` clean.
- [X] T016 [US1] Validate `quickstart.md` Step 1 — live-verified against the real Postgres
  instance: `POST /systems` and `POST /systems/:id/artifacts` create "Vexur" +
  "vexur-operacao-contrato-adesao" (Tela/Vue 2.0), both correctly persisted and listed.

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Associar Sistemas a Clientes (Priority: P1)

**Independent Test**: Associar um Sistema a um Cliente e confirmar que a associação
aparece na tela do Cliente, sem depender de nenhuma demanda (spec.md Independent Test).

- [X] T017 [US2] Extend `ClientsService` (`apps/api/src/modules/clients/
  clients.service.ts`) with `listSystems(clientId)` and `setSystems(clientId, systemIds)`
  — soft-remove (`stAtivo: false`) + upsert `$transaction`, never `deleteMany`
  (constitution; same pattern already fixed for `ProjectTechnology`/`RolePermission`);
  reject `systemIds` referring to an inactive `System` (FR-004, 422).
- [X] T018 [US2] Add `GET/PUT /clients/:id/systems` in `apps/api/src/modules/clients/
  clients.controller.ts`, `RequirePermission("SYSTEM_READ"/"SYSTEM_WRITE")` — depends on
  T017. `AuditLog` handled automatically by the global `AuditInterceptor` for the `PUT`
  (see T011's note) — no manual write needed.
- [X] T019 [US2] [P] Add `useClientSystems`/`useSetClientSystems` hooks — ended up in
  `apps/web/src/services/useSystems.ts` alongside the `System`/`SystemArtifact` types
  they depend on, not `useClients.ts` (avoids a circular/awkward cross-import).
- [X] T020 [US2] [P] Add a "Sistemas" section (checkbox list over active `System`s,
  pre-checked from `GET /clients/:id/systems`) to `apps/web/src/pages/Clients.tsx`'s edit
  modal — same embedded-list pattern as `RolePermissions` in `Settings.tsx`. `tsc`/`tsc -b`
  clean on both api and web.
- [X] T021 [US2] Validate `quickstart.md` Step 2 — live-verified: associated "Vexur" to two
  different real Clients ("Rede Probem" and "QV Benefícios") via `PUT /clients/:id/systems`
  — confirmed both show it in `GET /clients/:id/systems`, no duplication, exactly the real
  scenario that drove the Sistema/Artefato independent-entity decision in Clarifications.

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Selecionar Sistemas e Artefatos na Especificação Assistida (Priority: P2)

**Independent Test**: Abrir a Especificação Assistida de uma demanda de um Cliente com
Sistemas associados, selecionar Sistemas e Artefatos, e confirmar que a seleção é salva e
reaparece ao reabrir a tela (spec.md Independent Test).

- [X] T022 [US3] Extend `DemandsService` (`apps/api/src/modules/demands/
  demands.service.ts`) with `getAvailableAndSelectedSystems(demandId)`,
  `setSelectedSystems(demandId, systemIds)`, `getAvailableAndSelectedSystemArtifacts(demandId)`,
  `setSelectedSystemArtifacts(demandId, systemArtifactIds)` — enforce FR-013 (System must be
  associated, via active `ClientSystem`, with the demand's Client) and FR-012 (SystemArtifact
  must belong to a System present in the demand's `DemandSystem` selection), 422 on
  violation (SC-006) — soft-remove+upsert pattern, same as T017.
- [X] T023 [US3] Add `GET/PUT /demands/:id/systems` and `GET/PUT /demands/:id/system-artifacts`
  in `apps/api/src/modules/demands/demands.controller.ts`, `RequirePermission
  ("DEMAND_SYSTEM_WRITE")` on the `PUT`s — depends on T022. `AuditLog` via the global
  interceptor (T011's note), no manual write.
- [X] T024 [US3] Extend `DeveloperAgentService` (`apps/api/src/modules/executions/
  developer-agent.service.ts`) with `ensureSystemArtifactCataloged(demandId, name, type)`
  (research.md §6, FR-023): resolves the demand's first `DemandSystem`, reuses/creates a
  `SystemArtifact` under it (matched by `(systemId, name)`, no DB unique constraint —
  looked up via `findFirst`), upserts an active `DemandSystemArtifact` — called from
  `recordImplementationFiles()` whenever at least one file is recorded as `DISCOVERED`,
  using the underlying `Artifact`'s name/type. No-op if the demand has no Sistema selected
  yet (spec.md Edge Cases).
- [X] T025 [US3] [P] Add `useDemandSystems`/`useSetDemandSystems`/`useDemandSystemArtifacts`/
  `useSetDemandSystemArtifacts` hooks — done as part of T013/T019 in
  `apps/web/src/services/useSystems.ts`.
- [X] T026 [US3] [P] Add a "Sistemas e Artefatos Envolvidos" section to
  `apps/web/src/pages/SpecificationWorkspace.tsx`: multi-select over available Systems
  (restricted to the demand's Client, FR-007), then a nested multi-select over each
  selected System's active Artifacts (FR-009) — matches the source document's suggested UI
  (`Plano de Implementação` §15). `tsc`/`tsc -b` clean on both api and web.
- [X] T027 [US3] Validate `quickstart.md` Step 3 — live-verified against a real demand
  ("Demanda do jurídico / VIP", Client "Rede Probem"): selection persisted across a
  fresh `GET`; both 422 scenarios confirmed (`PUT .../systems` with a System not
  associated with the Client → 422; `PUT .../system-artifacts` with an Artefato whose
  System isn't selected → 422); FR-025 confirmed — after deactivating the selected
  System, it disappeared from `available` but stayed in `selected` (`/speckit.analyze`
  finding F2).

**Checkpoint**: User Stories 1-3 all work independently.

---

## Phase 6: User Story 4 - Gerar e copiar o Prompt SPEC, sem envio direto para IA (Priority: P2)

**Independent Test**: Preencher informações de negócio e insumos técnicos, com
Sistemas/Artefatos já selecionados (US3), acionar "Gerar Prompt SPEC" e confirmar que o
conteúdo gerado inclui todas essas informações e pode ser copiado — sem nenhuma chamada de
rede para um provedor de IA (spec.md Independent Test).

- [X] T028 [US4] Implement prompt generation
  (`apps/api/src/modules/demands/prompt-spec.service.ts`, new `PromptSpecService`): reads
  `apps/api/prompts/prompt-spec-kit.md` from disk (path resolved relative to `__dirname`,
  same reasoning as `WORKSPACE_ROOT`), consolidates demand/client/business/technical/
  systems/artifacts context, substitutes the single
  `[COLE AQUI A ESPECIFICAÇÃO DE NEGÓCIO]` placeholder — pure string building, zero
  network/provider calls (FR-018) — per contracts/prompt-generation.md.
- [X] T029 [US4] Add `POST /demands/:id/prompt-spec` in `demands.controller.ts`,
  `RequirePermission("SPEC_PROMPT_GENERATE")` — depends on T028. `AuditLog` via the global
  interceptor.
- [X] T030 [US4] In `apps/web/src/pages/SpecificationWorkspace.tsx`, remove the
  "Enviar para IA" button and AI-proposal panel from the rendered JSX (research.md §5 —
  the underlying hooks/endpoints/`specification_copilot` flow stay in the codebase,
  reachable only via `Agents.tsx`, not deleted) — FR-019.
- [X] T031 [US4] Add a "Gerar Prompt SPEC" button, a read-only prompt display, and a
  "Copiar Prompt" action (`navigator.clipboard.writeText`) to
  `SpecificationWorkspace.tsx`, calling T029's endpoint with the current
  `businessText`/`technicalText` state (FR-016, FR-017, FR-024) — depends on T030 (same
  file — no `[P]`, `/speckit.analyze` finding F1).
- [X] T032 [US4] Validate `quickstart.md` Step 4 — live-verified: `POST /demands/:id/prompt-spec`
  returned a complete, correctly structured prompt (10,657 chars) with demand context,
  Client, business/technical notes, Sistemas and Artefatos all correctly interpolated into
  the real `prompt-spec-kit.md` template; API logs inspected for the request window — zero
  references to any LLM provider host (SC-005).

**Checkpoint**: All four user stories independently functional and working together.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T033 [P] Update `README.md`'s module map with the new `systems` module and the
  `clients`/`demands`/`SpecificationWorkspace` extensions.
- [X] T034 Verify `GET /systems` (and any other new list endpoint) enforces the shared
  `paginate()` `page_size` cap, consistent with the platform-wide rule since 002.
  Live-verified: `?page_size=9999` returns `page_size: 100`.
- [X] T035 Verify the seeded `admin` user has all 6 new permissions (T008) — no regression
  check, same pattern used in feature 004 T037. Live-verified: 0 missing.
- [X] T036 Validate `quickstart.md` Step 5 (Developer Agent auto-catalog, FR-023).
  Live-verified via a direct call to `DeveloperAgentService.recordImplementationFiles()`
  against the real Postgres instance (cheaper and more precise than running a full paid
  "Modo B" implementation round just to exercise this one code path): a DISCOVERED file
  against the demand's existing `Artifact` ("Tela VIP", SCREEN/React) correctly (1) wrote
  the `ArtifactFile` as DISCOVERED, (2) created a new `SystemArtifact` "Tela VIP" under the
  demand's selected Sistema (Vexur), (3) auto-selected it via `DemandSystemArtifact`.
- [X] T037 Run `pnpm -r exec tsc --noEmit`, `pnpm -r exec eslint .`, and `pnpm -r build`
  clean across the whole monorepo. All three clean (eslint: same 3 pre-existing warnings
  in `github-repository.provider.ts`/`monday-demand.provider.ts`, 0 errors, unrelated to
  this feature).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational only (reads/writes `System` from
  US1, but its own Client-association endpoints work against any existing `System` row —
  independently testable once at least one `System` exists via US1).
- **User Story 3 (Phase 5)**: Depends on Foundational; exercised meaningfully only once
  US1 (Systems/Artifacts exist) and US2 (Client association exists) are in place, though
  its own code has no hard dependency on US2's endpoints.
- **User Story 4 (Phase 6)**: Depends on Foundational; exercised meaningfully only once
  US3's selection exists (the prompt includes selected Systems/Artifacts), though FR-018's
  "no LLM call" guarantee and the button-hiding (T030) are independently verifiable without
  any selection at all.
- **Polish (Final Phase)**: Depends on all four user stories being complete.

### Parallel Opportunities

- All Foundational schema tasks (T002-T006) run in parallel — different Prisma models in
  the same file, but additive and non-conflicting; sequence the actual file edit, keep the
  `[P]` marker for planning/reasoning purposes as in prior features.
- Within each user story, frontend hook + page/component tasks marked `[P]` run in
  parallel with each other (different files), after that story's backend tasks land.
- User Stories 1 and 2 can be implemented in parallel by different people once
  Foundational is done (T010's `systems` module and T017's `clients` extension touch
  different files).

---

## Implementation Strategy

### MVP First

User Stories 1 and 2 are both P1 — together they deliver the full catalog + Client
restriction, a coherent standalone increment (an admin can fully manage Sistemas/Artefatos
and control which Clients see which, even before the SPEC screen changes anything). Stop
and validate after Phase 4 before continuing to US3/US4.

### Incremental Delivery

1. Setup + Foundational → base ready.
2. US1 → Sistemas/Artefatos cadastráveis → validate independently.
3. US2 → restrição por Cliente funcionando → validate independently (MVP checkpoint).
4. US3 → seleção na Especificação Assistida → validate independently.
5. US4 → geração/cópia do Prompt SPEC, IA escondida → validate independently.
6. Polish.
