# Data Model: Agente QA, Geração de Testes e Validação Funcional

Todos os models novos seguem a convenção obrigatória já usada por todo o schema (Constituição — "Mandatory table fields"): `id` (UUID), `stAtivo`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy`, `updatedBy`, `version`. Omitidos abaixo por brevidade — só os campos específicos de cada entidade estão listados.

## `TestCase` (novo)

Um Caso de Teste gerado pelo Agente QA — independente de tecnologia de execução (spec FR-006).

| Campo | Tipo | Notas |
|---|---|---|
| `demandId` | `String` (FK → `Demand`) | |
| `artifactId` | `String?` (FK → `Artifact`) | nullable — um Test Case pode ser transversal a mais de um artefato |
| `title` | `String` | |
| `type` | `String` | `API` \| `UI` \| `UNIT` \| `FUNCTIONAL` \| `REGRESSION` — string livre, mesmo padrão já usado por `Artifact.type`/`SystemArtifact.type` neste schema, não enum |
| `scenario` | `String` | `POSITIVE` \| `NEGATIVE` \| `AUTHORIZATION` \| `AUTHENTICATION` \| `INTEGRATION` \| `REGRESSION` |
| `preconditions` | `String?` | |
| `data` | `Json?` | dados de entrada do cenário |
| `steps` | `String` | passos, texto livre (markdown) |
| `expectedResult` | `String` | |
| `criticality` | `String?` | livre (ex.: `LOW`/`MEDIUM`/`HIGH`) — documento de origem não define escala fechada |
| `automatable` | `Boolean` | `@default(false)` |
| `generatedByExecutionId` | `String?` (FK → `AgentExecution`) | qual execução do Agente QA gerou este caso |

Índice: `@@index([demandId])`.

## `FunctionalTestExecution` (novo — Fase 3/4, desenhado agora para não exigir redesenho)

Uma execução real de um `TestCase` contra um ambiente (spec FR-014).

| Campo | Tipo | Notas |
|---|---|---|
| `testCaseId` | `String` (FK → `TestCase`) | |
| `demandId` | `String` (FK → `Demand`) | |
| `environment` | `String` | ex.: `homologacao` |
| `startedAt` | `DateTime?` | |
| `finishedAt` | `DateTime?` | |
| `status` | `String` | `NOT_EXECUTED` \| `RUNNING` \| `PASS` \| `FAIL` \| `BLOCKED` — `@default("NOT_EXECUTED")` |
| `error` | `String?` | |

Índice: `@@index([demandId])`.

## `TestEvidence` (novo — Fase 3/4)

Artefato produzido por uma `FunctionalTestExecution` (spec FR-014).

| Campo | Tipo | Notas |
|---|---|---|
| `functionalTestExecutionId` | `String` (FK → `FunctionalTestExecution`) | |
| `type` | `String` | `screenshot` \| `video` \| `trace` \| `request` \| `response` \| `logs` |
| `storageRef` | `String?` | referência MinIO/S3 para binários (screenshot/vídeo/trace) |
| `content` | `String?` | texto inline para request/response/logs (quando não é um binário) |

## `Project` (alterado)

| Campo novo | Tipo | Notas |
|---|---|---|
| `qaAutoExecutionEnabled` | `Boolean` | `@default(false)` — mesmo nível de `requiredTestSuites`. Controla se a execução automática de testes (Fase 6, futura) pode ocorrer como parte do pipeline deste Projeto. |

## `Agent` (sem alteração de schema — nova linha de dados)

Seed novo em `apps/api/prisma/seed.ts`: `{ name: "QA Agent", type: "qa" }` — `Agent.type` já é `String` livre.

## `Demand.status` (sem alteração de schema — extensão do array de referência)

`WORKFLOW_STAGES` (`apps/api/prisma/seed.ts`) ganha os novos estados do documento de origem, na ordem:

```
IMPLEMENTED → TESTS_GENERATED → PR_CREATED → PR_APPROVED → GMUD_CREATED →
DEPLOYED_HOMOLOGATION → READY_FOR_FUNCTIONAL_TEST → FUNCTIONAL_TESTING →
FUNCTIONAL_TEST_PASSED | FUNCTIONAL_TEST_FAILED → READY_FOR_PRODUCTION
```

Nenhuma automação de transição entre esses estados é implementada nesta rodada (spec Assumptions) — servem para exibição/rastreio; avanço continua manual onde já é manual hoje (PR, GMUD).

## Relacionamentos (resumo)

```
Demand 1──N TestCase
Demand 1──N FunctionalTestExecution
TestCase 1──N FunctionalTestExecution
FunctionalTestExecution 1──N TestEvidence
AgentExecution 1──N TestCase (generatedByExecutionId)
Project 1──1 qaAutoExecutionEnabled (campo, não relação)
```
