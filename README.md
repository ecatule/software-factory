# AI Software Factory

A platform to manage and automate a software factory using AI agents and
Spec-Driven Development (SDD), controlling a demand's lifecycle from intake
through implementation and Pull Request — with full traceability, operated
through a web console.

See [`specs/001-ai-software-factory/`](specs/001-ai-software-factory/) (backend +
the per-demand cockpit), [`specs/002-web-console/`](specs/002-web-console/)
(the rest of the administrative console),
[`specs/003-ai-assisted-specification/`](specs/003-ai-assisted-specification/) (the
AI-assisted specification copilot, Technology catalog, and Increments), and
[`specs/004-advanced-console-governance/`](specs/004-advanced-console-governance/)
(environment/branch fields, granular RBAC permissions, richer Dashboard/Demands,
tabbed Cockpit, manual Artifact creation), and
[`specs/005-system-catalog-spec-prompt/`](specs/005-system-catalog-spec-prompt/)
(Sistema/Artefato technical catalog, Client×Sistema association, Sistema/Artefato
selection on the Especificação Assistida screen, and "Gerar Prompt SPEC" — a
zero-LLM-call prompt generator replacing the direct "Enviar para IA" action there)
for the full spec-kit artifact sets, and
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) for the
project's non-negotiable principles.

## Stack

- **Backend**: NestJS + TypeScript, Prisma/PostgreSQL, BullMQ/Redis, Passport +
  `openid-client` (OAuth2/OIDC Authorization Code + PKCE, JWT access/refresh)
- **Frontend**: React + TypeScript + Vite, TanStack Query, TanStack Table,
  react-hook-form, react-markdown
- **Monorepo**: pnpm workspaces (`apps/*`, `packages/*`)

## Module map

```text
apps/
├── api/            NestJS backend
│   └── src/modules/
│       ├── identity/       OIDC login/callback/session/logout, JWT refresh, RBAC guard
│       ├── clients/        Client CRUD; feature 005 adds `GET/PUT /clients/:id/systems`
│       │                   (Client×Sistema N:N association)
│       ├── projects/       Project CRUD (filterable by client)
│       ├── systems/        System/SystemArtifact technical catalog (feature 005) — new,
│       │                   independent of Project/Artifact (Clarifications 2026-08-10: a
│       │                   real system can span multiple Client-scoped Project rows today,
│       │                   which would have forced data consolidation to reuse Project)
│       ├── providers/      DI wiring for Provider interfaces + Settings CRUD (Provider/
│       │                   ProviderConfiguration) + `ProviderConfigurationResolver`, which
│       │                   actually resolves the saved model/auth-profile per project+stage
│       │                   at execution time (previously stored but never consulted)
│       ├── demands/        Demand intake/tracking, cockpit + dashboard read-models,
│       │                   enriched list (client/project/agent/PR filters) + Monday import
│       │                   (feature 004). Feature 005 adds `GET/PUT :id/systems` and
│       │                   `:id/system-artifacts` (Sistema/Artefato selection for the
│       │                   Especificação Assistida screen) and `PromptSpecService`
│       │                   (`POST :id/prompt-spec` — consolidates demand context into the
│       │                   versioned `apps/api/prompts/prompt-spec-kit.md` template, zero
│       │                   LLM calls, replacing the direct "Enviar para IA" action there)
│       ├── dashboard/      Stage-count summary + recent demands, plus feature 004's richer
│       │                   KPIs (totals, PRs open, tests failing, agents running, by-client,
│       │                   avg time per stage via `AuditLog` STAGE_TRANSITION rows)
│       ├── agents/         Agent catalog listing
│       ├── workflows/      Data-driven Workflow/WorkflowStage/WorkflowTransition; feature 004
│       │                   adds explicit `AuditLog` STAGE_TRANSITION rows on every transition
│       │                   (worker-triggered ones bypass the HTTP-only AuditInterceptor)
│       ├── executions/     AgentExecution queue + BullMQ worker + Developer Agent +
│       │                   the AI-assisted specification round (agent.type
│       │                   "specification_copilot" — first real caller of LLM_PROVIDER).
│       │                   The SDD pipeline stages (specify/clarify/plan/checklist/tasks/
│       │                   analyze/implement) now run via headless Claude Code ("Modo B",
│       │                   `SpecKitProvider`) — requires the `claude` and `specify` CLIs
│       │                   installed and authenticated on whatever host runs this worker;
│       │                   see `.env.example`'s "SDD pipeline" section
│       ├── specifications/ Specification/SpecificationVersion (versioning, diff, restore,
│       │                   upload-as-version, approve+immutability), SpecificationContextService
│       │                   (feature 004: `resolveOriginBranch()` for the "Branch de Origem" auto-fill)
│       ├── technologies/   Technology CRUD + Project association (feature 003)
│       ├── increments/     Increment lifecycle — lazy "current increment" creation +
│       │                   the explicit "create next increment" action (feature 003)
│       ├── workspaces/     DemandWorkspace creation on disk (spec/ + artefatos/) + cross-demand listing
│       ├── artifacts/      Artifact/ArtifactFile, cross-demand listing; feature 004 exposes the
│       │                   pre-existing demand-scoped `POST` via a manual-creation form
│       ├── repositories/   Repository listing + linked artifacts; feature 004 adds
│       │                   production/homologation branch fields + a `PATCH` endpoint
│       │                   (previously read-only)
│       ├── tests/          TestRunner (required test suites)
│       ├── git/            Test Gate, Commit/PullRequest, per-demand + cross-demand Git activity
│       ├── audit/          Audit log search (paginated)
│       └── roles/          Role/Permission catalog + `RolePermission` assignment (feature 004
│                            granular RBAC: DEMAND_READ/WRITE, SPECIFICATION_WRITE/APPROVE,
│                            AGENT_EXECUTE, GIT_WRITE, PR_CREATE, AUDIT_READ)
│
└── web/            React frontend — 18 screens (Login, Dashboard, Clients, Projects,
                    Sistemas (feature 005), Technologies, Demands, Workspaces, Artifacts,
                    Especificação Assistida, Agents, Executions, Tests, Repositories,
                    Git Activity, Audit, Settings). Feature 004: the Demand Cockpit is a
                    9-tab shell (Summary/Specification/Artifacts/Tasks/Development/Tests/
                    Git/Timeline/Audit) with the active tab in the URL
                    (`/demands/:demandId/:tab`) instead of one long stacked page. Feature
                    005: Especificação Assistida no longer sends anything to an LLM
                    directly — "Enviar para IA" was removed from its JSX (the
                    specification_copilot/"Modo B" flow behind it is untouched, still
                    reachable via Agents.tsx) in favor of selecting Sistemas/Artefatos and
                    a "Gerar Prompt SPEC" action the analyst copies into any AI manually.

packages/
├── domain/          Provider interfaces (DemandProvider, LLMProvider, SDDProvider,
│                     CodeRepositoryProvider, StorageProvider) — no I/O
├── application/      Reserved for cross-module use cases (currently empty)
├── infrastructure/   Concrete Provider adapters: Monday, ChatGPT, Claude, Spec Kit, GitHub
├── contracts/         Reserved for shared DTO/OpenAPI types (currently empty)
├── shared/            Cross-cutting utilities (currently empty)
├── config/            Env-schema loader (zod)
└── ui/                Shared React primitives: DataTable, Pagination, FormField,
                        Modal, Badge, MarkdownEditor, DiffView (built as ESM —
                        see note below)
```

Only `packages/infrastructure` imports third-party provider SDKs; everything
else depends on the `packages/domain` interfaces — this is what makes the
constitution's Provider Abstraction and AI Agent Boundary principles
enforceable by module boundaries. `packages/ui` is compiled to ESM (not the
monorepo's default CommonJS) because it's consumed only by the Vite/Rollup
frontend build, which cannot reliably interop with a CJS star-export barrel.

## Setup

```bash
cp .env.example .env   # fill in real secrets locally; never commit .env
pnpm install
docker compose up -d postgres redis minio
pnpm --filter @software-factory/api exec prisma migrate dev
pnpm prisma:seed
pnpm dev:api    # http://localhost:3000, OpenAPI docs at /docs
pnpm dev:web    # http://localhost:5173
```

Sign-in requires a configured OIDC identity provider (`OIDC_ISSUER_URL`,
`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` in `.env`).

See [`specs/001-ai-software-factory/quickstart.md`](specs/001-ai-software-factory/quickstart.md),
[`specs/002-web-console/quickstart.md`](specs/002-web-console/quickstart.md), and
[`specs/003-ai-assisted-specification/quickstart.md`](specs/003-ai-assisted-specification/quickstart.md)
for full end-to-end validation scripts.

## Status

Implemented via `/speckit.implement` against all three features' `tasks.md`.
All code type-checks (`tsc --noEmit`) and lints cleanly across `apps/api`,
`apps/web`, and every `packages/*`.

**Live-verified** against a real Postgres database: 001's core flow (clients,
projects, demands incl. re-import rejection, workspace creation,
workflow/timeline/trace, audit logging, JWT auth) and 002's MVP tier
(dashboard summary, the client filter on `GET /projects`, paginated/filtered
`GET /demands`), plus workspaces/artifacts/repositories/agents listing, the
`SC-007` pagination cap (`page_size` clamped to 100 server-side), and
`Settings`/`ProvidersController`'s admin-only RBAC gate (verified with an
admin, a no-role, and an unauthenticated token) — see each feature's
`tasks.md` Live-validation notes for the real runtime bugs this surfaced and
fixed (a directory-import Node rejects at runtime, missing workspace package
dependencies, a NestJS DI wiring gap, a CJS/ESM interop failure in the Vite
build, a Prisma relation that didn't exist as assumed, an unenforced
pagination cap, and a global-guard ordering bug that broke `@Roles()` checks
for every role including admin).

**003 (AI-Assisted Specification & Increments) live-verified** against the same real
Postgres instance: Technology CRUD + Project association (and that the association
flows into the AI context, `GET /projects/:id/technologies`), the lazy "increment 1"
creation and the FR-018 409 gate blocking a second increment before the first is
approved, the direct-upload alternative to the AI copilot
(`POST /specifications/:id/versions/upload`), approval with immutability
(`approvedBy`/`approvedAt`/`approvalComment` set, a second approve attempt on the same
version correctly 409s), and the `page_size` cap on `GET /technologies`. The API boots
cleanly with no NestJS DI/circular-dependency errors despite `DemandsModule`,
`ExecutionsModule`, and `SpecificationsModule` all depending on `IncrementsModule`.
Two real bugs were found and fixed during this live-validation pass — see
`specs/003-ai-assisted-specification/tasks.md`/`contracts/specification-copilot.md` for
details: (1) the increment-1 lazy-creation logic was originally scoped only inside User
Story 3's module, which would have broken User Story 1's independent-testability claim
(caught by `/speckit.analyze` before implementation, finding F1); (2) a brand-new demand
had no `Specification` row and therefore no way to reach the Especificação Assistida
screen at all — fixed by adding a lazy "ensure specification" endpoint (caught live,
during implementation, since `/speckit.analyze` only reasons over the task list, not
runtime behavior).

**004 (Advanced Console & Governance) live-verified** against the same real Postgres
instance, now with Redis also reachable (confirmed 2026-08-09): `PATCH /projects/:id` and
`PATCH /repositories/:id` persisting branch/environment fields and
`GET /demands/:id/origin-branch` resolving them (project fallback confirmed; repository
takes precedence when linked); `GET /roles/:id/permissions` showing the seeded `admin`
role holds all 8 catalog permissions (SC-004, no regression from introducing granular
RBAC); `RbacGuard`'s permission check confirmed both ways with a scoped-down token (403 on
`POST /demands`/`GET /audits`, 200 on `GET /demands`); `GET /dashboard/summary`'s new KPI
fields (totals, PRs open, tests failing, agents running, by-client, avg time per stage);
`GET /demands` enriched fields/filters and the `page_size` cap holding at 100 even when
`9999` is requested; manual artifact creation via `POST /demands/:id/artifacts` including
the `description` field. **The full BullMQ/Redis pipeline is now live-verified
end-to-end**: `POST /executions` returns `201 QUEUED` immediately (previously hung
indefinitely) and the worker picks it up within seconds — the run then reached `FAILED`
with `ChatGPT API error: 401 Unauthorized`, and `POST /demands/import` similarly reached
`MondayDemandProvider` and got `Monday API error: 401 Unauthorized`; both are this
environment's expired/empty `OPENAI_API_KEY`/`MONDAY_API_TOKEN`, not code defects — the
queue, worker, and provider wiring itself all behaved correctly.

One real bug was found and fixed during this live-validation pass: `UpdateProjectDto` was
never extended with the 4 new branch/environment fields (`productionBranch`,
`homologationBranch`, `homologationEnvironment`, `productionEnvironment`) even though the
frontend edit form (`Projects.tsx`) already sent them — `ValidationPipe`'s `whitelist: true`
silently stripped them on every save, so the "Branch de Origem" feature this whole increment
was partly meant to unblock would have kept resolving to `null`. Fixed by adding the 4
fields to the DTO; confirmed live afterwards.

**Not yet live-verified**: MinIO/docker-compose itself; the real LLM call and Monday import
succeeding end-to-end (both need live `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`MONDAY_API_TOKEN`,
all currently invalid or empty in this `.env`); 001 P2's external integrations (the Spec Kit
CLI, GitHub); 002's OIDC login flow itself (needs a real identity provider) — these need real
credentials and an OIDC provider that weren't available during implementation. Run the
quickstarts above with those in place to finish validating before production use.
