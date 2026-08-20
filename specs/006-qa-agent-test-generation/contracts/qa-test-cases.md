# Contract: QA — Test Cases (Fase 1)

Implements spec FR-001 through FR-007 (User Story 1).

## `GET /api/v1/demands/:demandId/qa/test-cases` (new)

- **200**: `TestCase[]` gerados para a demanda (todos, sem paginação — mesmo padrão de `GET /demands/:demandId/tests`, volume por demanda é sempre pequeno).
- Requires `QA_READ`.
- Mesmo padrão de `TestsController`/`ExecutionsController`: só `JwtAuthGuard` a nível de controller + `@RequirePermission("QA_READ")` no handler.

### Response shape

```json
[
  {
    "id": "uuid",
    "demandId": "uuid",
    "artifactId": "uuid | null",
    "title": "string",
    "type": "API | UI | UNIT | FUNCTIONAL | REGRESSION",
    "scenario": "POSITIVE | NEGATIVE | AUTHORIZATION | AUTHENTICATION | INTEGRATION | REGRESSION",
    "preconditions": "string | null",
    "data": {},
    "steps": "string",
    "expectedResult": "string",
    "criticality": "string | null",
    "automatable": true,
    "generatedByExecutionId": "uuid | null",
    "createdAt": "ISO date"
  }
]
```

## Geração (não é um endpoint HTTP disparado manualmente na Fase 1)

A geração de Test Cases NÃO tem endpoint próprio — acontece automaticamente dentro do `ExecutionsProcessor` (mesma `AgentExecution` do tipo `"developer"`), entre `implement` e `commit` (ver `research.md` §3/§4). O resultado fica visível via `GET /demands/:demandId/qa/test-cases` assim que a `AgentExecution` avança pra `commit`.

### Falha genuína bloqueia o Commit (spec FR-003, Clarification #3)

Se a geração falhar por erro técnico (não por "nenhum cenário aplicável"), a `AgentExecution` é marcada `FAILED` com o erro, e o Commit não acontece — mesmo comportamento já existente do Test Gate (`GitService.assertTestGatePassed`).

## Audit

Igual ao padrão já existente para geração automática (`PRE_IMPLEMENT_AUTO_SANITIZED`/`PRE_IMPLEMENT_SAFETY_BLOCK` em `AuditLog`, ver `developer-agent.service.ts`) — a geração de QA grava `QA_TEST_CASES_GENERATED` (sucesso, com contagem por tipo/cenário) ou `QA_GENERATION_FAILED` (falha genuína).
