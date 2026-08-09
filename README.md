# AI Software Factory

A platform to manage and automate a software factory using AI agents and
Spec-Driven Development (SDD), controlling a demand's lifecycle from intake
through implementation and Pull Request — with full traceability, operated
through a web console.

See [`specs/001-ai-software-factory/`](specs/001-ai-software-factory/) (backend +
the per-demand cockpit) and [`specs/002-web-console/`](specs/002-web-console/)
(the rest of the administrative console) for the full spec-kit artifact sets, and
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
│       ├── clients/        Client CRUD
│       ├── projects/       Project CRUD (filterable by client)
│       ├── providers/      DI wiring for Provider interfaces + Settings CRUD (Provider/ProviderConfiguration)
│       ├── demands/        Demand intake/tracking, cockpit + dashboard read-models
│       ├── dashboard/      Stage-count summary + recent demands (server-side aggregation)
│       ├── agents/         Agent catalog listing
│       ├── workflows/      Data-driven Workflow/WorkflowStage/WorkflowTransition
│       ├── executions/     AgentExecution queue + BullMQ worker + Developer Agent
│       ├── specifications/ Specification/SpecificationVersion (versioning, diff, restore)
│       ├── workspaces/     DemandWorkspace creation on disk (spec/ + artefatos/) + cross-demand listing
│       ├── artifacts/      Artifact/ArtifactFile, cross-demand listing
│       ├── repositories/   Repository listing + linked artifacts
│       ├── tests/          TestRunner (required test suites)
│       ├── git/            Test Gate, Commit/PullRequest, per-demand + cross-demand Git activity
│       └── audit/          Audit log search (paginated)
│
└── web/            React frontend — 15 screens (Login, Dashboard, Clients, Projects,
                    Demands, Workspaces, Artifacts, Specification editor, Agents,
                    Executions, Tests, Repositories, Git Activity, Audit, Settings)

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

See [`specs/001-ai-software-factory/quickstart.md`](specs/001-ai-software-factory/quickstart.md)
and [`specs/002-web-console/quickstart.md`](specs/002-web-console/quickstart.md)
for full end-to-end validation scripts.

## Status

Implemented via `/speckit.implement` against both features' `tasks.md`. All
code type-checks (`tsc --noEmit`) and lints cleanly across `apps/api`,
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

**Not yet live-verified**: MinIO/Redis/docker-compose itself; 001 P2's
external integrations (LLM calls, the Spec Kit CLI, GitHub); 002's OIDC login
flow itself (needs a real identity provider) and the P2-P5 screens built on
top of it (Workspaces, Artifacts, Specification editor, Agents, Executions,
Tests, Repositories, Git Activity, Audit, Settings) — these need real
credentials, Redis, and an OIDC provider that weren't available during
implementation. Run the quickstarts above with those in place to finish
validating before production use.
