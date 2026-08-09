# Phase 0 Research: AI Software Factory — Core Platform

Source technical-plan document (`documentos iniciais/doc-plan.md`) fixes the top-level stack
(React + TypeScript frontend, Node.js + TypeScript backend, PostgreSQL, monorepo, REST +
OpenAPI, Docker) and the layered architecture (React → REST API → Application → Domain →
Infrastructure → PostgreSQL) as non-negotiable. This research resolves the concrete tool
choices the source document leaves open, each judged against the constitution's principles
(Provider Abstraction, Extensibility Without Core Modification, low operational cost /
simplicity) and the spec's success criteria (SC-008 5s cockpit freshness, SC-009 business-hours
availability, SC-010 ≥10 concurrent demands).

## 1. Monorepo tooling

- **Decision**: pnpm workspaces, no build-orchestrator (Turborepo/Nx) for the MVP.
- **Rationale**: the constitution prioritizes low operational cost and simplicity; at this
  scale (a handful of `apps/*` and `packages/*`) plain workspaces with `pnpm -r` scripts are
  enough. Adding a build-graph tool before build times actually hurt would be premature
  complexity.
- **Alternatives considered**: Nx (powerful generators and caching, but a steeper learning
  curve and more configuration surface than this project currently needs); Turborepo (good
  incremental-build caching, but another tool to operate and learn before it's justified by
  measured pain).

## 2. Backend framework

- **Decision**: NestJS.
- **Rationale**: NestJS's module + dependency-injection system is a direct, idiomatic home
  for the constitution's Provider Abstraction principle — `LLMProvider`,
  `CodeRepositoryProvider`, `DemandProvider`, `SDDProvider`, and `StorageProvider` become DI
  interfaces bound to swappable adapter classes, with no domain code importing a vendor SDK.
  Its module boundaries also map almost one-to-one onto the source plan document's module
  list (Identity, Clients, Projects, Demands, Workspaces, Specifications, Artifacts, Agents,
  Executions, Workflows, Providers, Repositories, Branches, Commits, Tests, PullRequests,
  Audit), and `@nestjs/swagger` satisfies the constitution's OpenAPI/Swagger mandate with
  minimal extra authoring.
- **Alternatives considered**: Express or Fastify used directly (would require hand-building
  the same module/DI boundaries NestJS provides out of the box — more code, higher risk of
  the Provider Abstraction boundary eroding over time).

## 3. ORM / database access

- **Decision**: Prisma.
- **Rationale**: TypeScript-first generated types, first-class migrations, and a natural fit
  for enforcing the constitution's mandatory per-table columns
  (`id` UUID, `st_ativo`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`,
  `version`) via one shared base schema fragment reused by every model.
- **Alternatives considered**: TypeORM (weaker type inference, Active Record pattern tends to
  pull persistence concerns into entities, working against the domain/infrastructure
  separation); Drizzle (promising but its migration tooling is less mature).

## 4. Frontend tooling

- **Decision**: React + TypeScript + Vite, TanStack Query for server state, React Router for
  navigation.
- **Rationale**: matches the source document's React + TypeScript requirement; Vite keeps
  local dev/build simple and fast; TanStack Query directly supports the short-polling
  approach chosen for cockpit freshness (SC-008) with minimal boilerplate.
- **Alternatives considered**: Next.js (its SSR/server layer isn't needed — the API is
  already a separate NestJS service, so adding a second server runtime would be redundant
  complexity).

## 5. Async execution (AgentExecution / queue)

- **Decision**: BullMQ on Redis.
- **Rationale**: the source technical-plan document's own diagram for agent execution is
  `API → Queue → Worker → Agent → Provider → Workspace`, and names Redis explicitly as the
  candidate queue; BullMQ is the standard TypeScript-native client for Redis-backed queues
  and integrates cleanly with NestJS.
- **Alternatives considered**: RabbitMQ (a capable broker, but a separate infrastructure
  service not named in the source docs, and unjustified at the target scale of ≤10 concurrent
  demands); plain database polling with no queue (would not reliably meet the 5-second
  cockpit-freshness target under any real load).

## 6. API documentation

- **Decision**: `@nestjs/swagger`, generating an OpenAPI 3 document directly from NestJS
  controllers/DTOs.
- **Rationale**: satisfies the constitution's OpenAPI/Swagger requirement without a
  hand-maintained spec that can drift from the implementation.
- **Alternatives considered**: hand-written OpenAPI YAML maintained separately (real drift
  risk as endpoints evolve).

## 7. Authentication & authorization

- **Decision**: Passport.js OAuth2/OIDC strategies + `@nestjs/jwt` for access/refresh tokens;
  custom NestJS Guards implement RBAC.
- **Rationale**: matches the constitution's explicit OAuth2 / OpenID Connect / JWT / Refresh
  Token / RBAC requirements using the standard NestJS-ecosystem building blocks.
- **Open item, deliberately left flexible**: the specific external identity provider
  (e.g. Azure AD, Auth0, Keycloak, or another OIDC-compliant IdP) is a per-deployment
  configuration choice, not an architecture decision — the platform only needs to speak
  standard OAuth2/OIDC/JWT, so any compliant IdP can be plugged in later without code changes.
  This does not block design and is not treated as a `NEEDS CLARIFICATION`.

## 8. File & document storage split

- **Decision**: specification documents (spec.md, plan.md, research.md, etc.) are stored as
  versioned rows in PostgreSQL (`SpecificationVersion.content`); MinIO/S3, reached through a
  `StorageProvider` abstraction, holds larger binary artifacts only. OpenSearch is named in
  the constitution as "prepared for future inclusion" and is deliberately left out of the
  MVP `docker-compose.yml`; structured JSON logs (pino) go to stdout for now.
- **Rationale**: specification content needs relational versioning, diffing, and restore
  (spec FR-010/FR-011) — a relational table with a `version` column and history rows serves
  that directly, whereas object storage would require reimplementing diff/restore logic on
  top of blobs. Binary artifacts have no such requirement, so object storage is the simpler
  fit for them.
- **Alternatives considered**: storing all specification content as objects in MinIO with a
  separate metadata table (adds complexity for no benefit, since diff/restore would still
  need to read full blob contents into the database layer anyway).

## Outcome

All `NEEDS CLARIFICATION` markers from the Technical Context are resolved by the decisions
above. No item remains open that blocks Phase 1 design. The two details intentionally left
unspecified at this stage — the exact RBAC role/permission matrix, and the specification/audit
retention period — were already flagged as deferred-to-planning in spec.md's Assumptions
section; they affect data seeding and retention policy, not architecture, and are captured as
follow-up items in `data-model.md`.
