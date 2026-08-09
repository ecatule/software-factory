# Implementation Plan: Web Console — Administrative Screens

**Branch**: `002-web-console` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-web-console/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build the console's remaining 14 screens (only the per-demand cockpit exists today) as a UI
layer over the `001-ai-software-factory` backend, adding real OIDC-based login (replacing the
refresh-only auth that existed), and 10 new/extended backend list endpoints that the screens
need but the API never exposed (workspaces, artifacts, repositories, git activity, and
providers/settings listings, plus pagination on the two endpoints that already existed
unpaginated). No new persisted entities — this is additive UI plus API surface, not a new
data model.

## Technical Context

**Language/Version**: unchanged from 001 — TypeScript 5.x on Node.js 20 LTS; React 18 +
TypeScript 5.x.

**Primary Dependencies**: on top of 001's stack — `react-hook-form` (forms) and
`@tanstack/react-table` (tables/pagination/sorting) and `react-markdown` (specification
preview) on the frontend; `openid-client` (OIDC Authorization Code + PKCE) and `cookie-parser`
(httpOnly refresh-cookie handling) on the backend.

**Storage**: unchanged — PostgreSQL via Prisma. No new tables; see Data Model.

**Testing**: unchanged from 001 — Jest + Supertest for new/extended backend endpoints; no
dedicated frontend test framework introduced (not requested in spec.md).

**Target Platform**: unchanged — Docker Compose for local/MVP, Kubernetes-portable.

**Project Type**: Web application — extends the existing `apps/web` + `apps/api`; no new apps.

**Performance Goals**: list screens stay responsive at ≥500 records (spec SC-007) — every
new/extended list endpoint is server-side paginated, never client-side-filtered over a full
table dump.

**Constraints**: sign-in to any permitted screen in ≤2 clicks from anywhere (spec SC-001);
locate a failed execution's or failed test's error detail in ≤2 clicks from the Dashboard
(spec SC-004) — both are information-architecture constraints on navigation, not
infrastructure constraints.

**Scale/Scope**: 15 screens across 5 priority tiers; 13 new/extended backend endpoints; 0 new
persisted entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Standard | How this plan satisfies it |
|---|---|
| I. AI Agent Boundary | Unaffected by this feature — login is human-facing, not an AI provider call. The OIDC code exchange happens inside `apps/api` (`openid-client`), never in `apps/web` — consistent with "external calls only from the backend." |
| II. Provider Abstraction | Unaffected — no new AI/code/demand provider is introduced; the Settings screen manages existing `Provider`/`ProviderConfiguration` rows through a new REST surface, it doesn't add a new provider *kind*. |
| III. Extensibility Without Core Modification | Every addition here is additive: new pages/components in `apps/web`, new controllers/endpoints alongside existing ones in `apps/api`. No existing module's public contract changes. |
| IV. Test-Backed Quality | New/extended endpoints get Supertest coverage (added in `/speckit-tasks`); `tsc --noEmit`/ESLint gates from 001 continue to apply to `apps/web` and `apps/api` unchanged. |
| V. Security & Compliance by Default | This feature is what actually *fulfills* the constitution's OAuth2/OIDC/JWT/Refresh-Token requirement — 001 only had token refresh, never a real login. Refresh tokens move to an httpOnly Secure cookie (reduced XSS exposure vs. 001's `localStorage` access-token pattern). FR-031 adds a concrete secret-leak guard on the Settings screen. RBAC (`RbacGuard`) continues to gate every new endpoint. |
| Technology & Data Standards | No new tables. Every new/extended list endpoint reuses the mandatory-columns/soft-delete Prisma convention and the `{items, total, page, page_size}` pagination envelope already established by `GET /demands` in 001. |

**Result**: PASS — no violations. Complexity Tracking table below is intentionally empty.

**Deployment note (not a violation)**: httpOnly-cookie-based refresh tokens require the web
and API origins to share cookies correctly — proper `SameSite`/CORS configuration across the
dev ports (5173/3000), and a reverse proxy unifying the origin is recommended for production.
Tracked here as an operational note, not an architectural blocker.

**Post-Phase-1 re-check**: `data-model.md` (zero new tables, reused pagination envelope),
`contracts/*` (every write behind auth/RBAC, `settings.md`'s FR-031 secret guard, no endpoint
returns a provider secret), and `quickstart.md` (OIDC exchange confined to `apps/api`, refresh
token never JS-readable) introduce nothing that changes the table above — **still PASS, still
no violations**.

## Project Structure

### Documentation (this feature)

```text
specs/002-web-console/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
software-factory/
│
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── context/
│   │       │   └── AuthContext.tsx        # session state, sign-in/out, silent refresh via GET /auth/session
│   │       ├── routes/
│   │       │   └── ProtectedRoute.tsx     # wraps routes requiring auth + optional role check
│   │       ├── pages/
│   │       │   ├── Login.tsx
│   │       │   ├── Dashboard.tsx
│   │       │   ├── Clients.tsx
│   │       │   ├── Projects.tsx
│   │       │   ├── Demands.tsx            # list + create; per-demand detail stays DemandCockpit.tsx
│   │       │   ├── Workspaces.tsx
│   │       │   ├── Artifacts.tsx
│   │       │   ├── SpecificationEditor.tsx
│   │       │   ├── Agents.tsx
│   │       │   ├── Executions.tsx
│   │       │   ├── Tests.tsx
│   │       │   ├── Repositories.tsx
│   │       │   ├── GitActivity.tsx
│   │       │   ├── Audit.tsx
│   │       │   └── Settings.tsx
│   │       ├── components/
│   │       │   └── NavShell.tsx           # persistent navigation (spec FR-002/FR-003)
│   │       └── services/
│   │           └── useXxxList.ts          # one paginated-query hook per list screen, same shape as useDemandPolling
│   │
│   └── api/
│       └── src/modules/
│           ├── identity/auth/             # + oidc.service.ts, login/callback/session controller methods
│           ├── dashboard/                 # NEW module: GET /dashboard/summary
│           ├── workspaces/                # + GET /workspaces (list)
│           ├── artifacts/                 # + GET /artifacts (list)
│           ├── executions/                # executions.controller.ts: add pagination
│           ├── repositories/              # NEW module: GET /repositories, /:id, /:id/artifacts
│           ├── git/                       # + GET /branches, /commits, /pull-requests (list forms)
│           ├── audit/                     # audit.controller.ts: add pagination
│           └── providers/                 # + providers.controller.ts (new — module currently has no HTTP surface)
│
└── packages/
    └── ui/
        └── src/                           # first real components: DataTable, Pagination, FormField, MarkdownEditor, DiffView, ConfirmDialog
```

**Structure Decision**: Extends 001's existing Option-2 (web application) layout — no new
`apps/*` or `packages/*` directories. `packages/ui` (scaffolded empty in 001 for exactly this
purpose) gets its first real components, consumed by `apps/web`'s new pages. New backend
modules (`dashboard`, `repositories`) follow the same NestJS module/controller/service pattern
already established by every module in 001.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations — table intentionally left empty.*
