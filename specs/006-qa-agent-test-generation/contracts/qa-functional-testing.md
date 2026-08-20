# Contract: QA — Execução Funcional em Homologação (Fase 3/4, documentado para não exigir redesenho)

Implements spec FR-010 through FR-016 (User Stories 2, 3, 4).

## `POST /api/v1/demands/:demandId/qa/functional-tests/run` (new — Fase 3/4)

- **Body**: `{ testCaseIds?: string[] }` — omitido/vazio = todos os `TestCase` `automatable: true` da demanda (mesmo padrão de `artifactIds?` opcional já usado em `POST /demands/:demandId/pull-request`).
- Pré-requisito: a demanda precisa estar no estado `READY_FOR_FUNCTIONAL_TEST` ou posterior (ver `data-model.md`) — **422** caso contrário (spec User Story 3, cenário 3).
- **Environment Guard** (spec FR-012/FR-013): antes de qualquer chamada real, valida a URL-alvo (aplicação/API de homologação) contra `homologationEnvironment` em `project-environments/<projectId>.json` (ver `research.md` §5). Ambiente não reconhecido ou identificado como produção → **403** `TEST EXECUTION BLOCKED`, nenhuma chamada real ocorre.
- **202**: processamento assíncrono (mesmo padrão de fila BullMQ já usado por `AgentExecution`) — retorna os `FunctionalTestExecution` criados em `NOT_EXECUTED`/`RUNNING`.
- Requires `QA_EXECUTE` (Clarification #1 — permissão dedicada, não `AGENT_EXECUTE`).

## `GET /api/v1/demands/:demandId/qa/functional-tests` (new — Fase 3/4)

- **200**: `FunctionalTestExecution[]` da demanda, cada um com `testCase` (join) e `evidences: TestEvidence[]`.
- Requires `QA_READ`.

### Response shape

```json
[
  {
    "id": "uuid",
    "testCaseId": "uuid",
    "demandId": "uuid",
    "environment": "homologacao",
    "startedAt": "ISO date",
    "finishedAt": "ISO date | null",
    "status": "NOT_EXECUTED | RUNNING | PASS | FAIL | BLOCKED",
    "error": "string | null",
    "evidences": [
      { "id": "uuid", "type": "screenshot | video | trace | request | response | logs", "storageRef": "string | null", "content": "string | null" }
    ]
  }
]
```

## Bloqueio de "pronto para produção" (spec FR-015)

Não é um endpoint próprio — qualquer leitura existente de "está pronta pra produção" (ex.: dashboard, `Demand.status`) DEVE considerar: nenhuma demanda com `FunctionalTestExecution.status === "FAIL"` pode ser apresentada como `READY_FOR_PRODUCTION`, independente de qualquer outra condição já satisfeita.

## Audit

`QA_FUNCTIONAL_EXECUTION_STARTED`, `QA_FUNCTIONAL_EXECUTION_BLOCKED` (Environment Guard), `QA_FUNCTIONAL_EXECUTION_COMPLETED` (com resultado) em `AuditLog` — mesmo padrão já usado pelo safety-check pré-implementação.
