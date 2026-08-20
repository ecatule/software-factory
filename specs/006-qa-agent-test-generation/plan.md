# Implementation Plan: Agente QA, Geração de Testes e Validação Funcional

**Branch**: `006-qa-agent-test-generation` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-qa-agent-test-generation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Incorporar uma etapa formal de QA ao pipeline do Developer Agent: um novo Agente QA (novo `Agent.type = "qa"`) é acionado automaticamente logo após o `implement`, dentro da mesma `AgentExecution`, e gera Casos de Teste estruturados (positivos, negativos, autorização, autenticação, integração, regressão) analisando `spec.md`/`plan.md`/critérios de aceite/diff da implementação — sem executar nada. A geração é obrigatória: uma falha genuína bloqueia o Commit (mesmo comportamento do Test Gate já existente); a ausência de cenário aplicável não bloqueia. A execução automática de testes fica desabilitada por padrão via um novo campo por Projeto (`Project.qaAutoExecutionEnabled`). Uma nova permissão dedicada (`QA_EXECUTE`) controla quem pode disparar execução funcional manual em homologação (fases futuras) — o Environment Guard que protege essa execução reaproveita o mecanismo de configuração por projeto já existente (`project-environments/*.json`), nunca dependendo de decisão da IA.

Esta rodada de planejamento cobre o desenho completo (para não exigir redesenho nas fases seguintes), mas a Fase 1 — geração obrigatória de Test Cases integrada ao pipeline, sem execução — é o escopo imediatamente acionável por `/speckit-tasks`/`/speckit-implement`.

## Technical Context

**Language/Version**: TypeScript (Node.js) — mesmo stack de `apps/api` (NestJS 10) já existente.

**Primary Dependencies**: `@nestjs/bullmq` (fila já usada por `AgentExecution`), Prisma/PostgreSQL, Jest (runner de teste já usado pela plataforma — ver Decisão em `research.md`, não Vitest apesar do documento de origem sugerir). Playwright é dependência nova real, mas só entra na Fase 3 (Browser Test Runner), fora do escopo desta rodada.

**Storage**: PostgreSQL via Prisma — mesmo banco já usado por toda a plataforma.

**Testing**: Jest, mesmo runner já usado por `apps/api`.

**Target Platform**: mesmo backend NestJS já em produção (Docker, Kubernetes-ready).

**Project Type**: web-service — extensão do backend existente (`apps/api`), não um serviço novo separado.

**Performance Goals**: sem meta numérica nova — a geração de Test Cases roda como mais um estágio dentro do mesmo worker BullMQ já usado pelo Developer Agent (`ExecutionsProcessor`), sujeita ao mesmo timeout de subprocesso (`SDD_CLI_TIMEOUT_MS`) se reaproveitar o mecanismo de chamada headless já existente (`SDDProvider`).

**Constraints**: Environment Guard determinístico — validação em código, nunca dependente de uma decisão da IA (Constituição I; resolvido explicitamente na Clarification #3 da spec). Nenhuma credencial de produção pode ficar acessível aos executores de QA.

**Scale/Scope**: Fase 1 do documento técnico de origem — geração obrigatória de Test Cases + configuração `qaAutoExecutionEnabled` por Projeto (padrão desabilitada) + integração no pipeline entre `implement` e `commit`. Fases 2–6 (API/Browser Test Runner reais, Environment Guard completo para execução funcional, dashboard/métricas) ficam documentadas em `research.md`/`data-model.md` como direção arquitetural, sem tasks geradas para elas nesta rodada.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Justificativa |
|---|---|---|
| I. AI Agent Boundary | PASS | O Agente QA (LLM) só gera conteúdo (Test Cases) através do backend, que persiste e valida. Nenhum executor/ambiente é chamado diretamente pela IA. O Environment Guard é código determinístico no backend. |
| II. Provider Abstraction | PASS | `TestRunner`/`ApiTestRunner`/`BrowserTestRunner` do documento de origem viram um novo `TestExecutorProvider` (interface em `packages/domain`, implementação em `packages/infrastructure`), mesmo padrão de `CodeRepositoryProvider`/`SDDProvider` já existentes. Test Cases são desenhados desde o início como independentes de executor (spec FR-006). |
| III. Extensibility Without Core Modification | PASS | Novo `Agent.type = "qa"` usa um campo já `String` livre (sem enum Prisma) — não exige migração de schema nem mudança no Core. A própria Constituição já antecipa "future QA/homologation/production stages". |
| IV. Test-Backed Quality | PASS | Reaproveita Jest, já usado pela plataforma — não introduz uma segunda ferramenta de teste sem necessidade. |
| V. Security & Compliance by Default | PASS | `QA_EXECUTE` como permissão RBAC dedicada; Environment Guard bloqueia produção deterministicamente; nenhuma credencial de produção disponível aos executores (spec FR-013, documento de origem §22). |

Nenhuma violação identificada — Complexity Tracking permanece vazio.

## Project Structure

### Documentation (this feature)

```text
specs/006-qa-agent-test-generation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/domain/src/providers/
└── test-executor-provider.ts       # NOVO — interface TestExecutorProvider (Provider Abstraction)

packages/infrastructure/src/providers/
└── qa-test-executor.provider.ts    # NOVO — implementação inicial (Fase 1: sem execução real)

apps/api/src/modules/qa/
├── qa.module.ts                    # NOVO
├── qa.controller.ts                # NOVO — GET /demands/:demandId/qa/test-cases (Fase 1)
├── qa-generation.service.ts        # NOVO — chamado por ExecutionsProcessor entre implement e commit
└── dto/qa.dto.ts                   # NOVO

apps/api/src/modules/executions/
└── executions.processor.ts         # ALTERADO — novo estágio "qa" entre implement e commit

apps/api/prisma/
├── schema.prisma                   # ALTERADO — models TestCase, FunctionalTestExecution, TestEvidence; Project.qaAutoExecutionEnabled
└── seed.ts                         # ALTERADO — Agent "QA Agent" (type "qa"); permissões QA_READ, QA_EXECUTE; novos estados no array de referência de workflow

apps/web/src/
├── pages/ (ou components/cockpit-tabs/)
│   └── QaTab.tsx                   # NOVO (Fase 1: lista de Test Cases gerados)
└── services/useQa.ts               # NOVO
```

**Structure Decision**: extensão do monorepo NestJS + React já existente — nenhum projeto/serviço novo. Segue exatamente a mesma separação já usada por `executions`/`git`/`tests` (`apps/api/src/modules/<nome>/`), e o mesmo padrão de Provider Abstraction já usado por `CODE_REPOSITORY_PROVIDER`/`SDD_PROVIDER` (`packages/domain` + `packages/infrastructure`).

## Complexity Tracking

*Sem violações da Constituição a justificar — tabela vazia.*
