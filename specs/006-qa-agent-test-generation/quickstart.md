# Quickstart: Agente QA, Geração de Testes e Validação Funcional (Fase 1)

Valida a fatia implementável agora: geração obrigatória de Test Cases integrada ao pipeline, sem execução automática. Não cobre Fases 2-6 (execução real, Environment Guard completo) — ver `contracts/qa-functional-testing.md` para o desenho dessas fases.

## Pré-requisitos

- API rodando localmente (`apps/api`, mesmo processo já usado no resto da plataforma).
- Uma demanda com Sistemas/Artefatos selecionados e uma especificação (SPEC/PLAN) aprovada, pronta para o Developer Agent (mesmo pré-requisito já válido hoje para `/speckit-implement`).
- Migração aplicada (`prisma db push`/`migrate dev`) com os models novos (`TestCase`, `FunctionalTestExecution`, `TestEvidence`) e `Project.qaAutoExecutionEnabled`.
- Seed rodado (`prisma db seed`) — cria o `Agent` "QA Agent" (`type: "qa"`) e as permissões `QA_READ`/`QA_EXECUTE`.

## Cenário 1 — geração automática, sem execução

1. Disparar (ou reexecutar) o Developer Agent para a demanda de teste (tela Agentes, ou "Reexecutar" numa execução já `COMPLETED`, mesmo mecanismo já existente).
2. Acompanhar a tela Execuções: confirmar que, após o `pipelineStage: "implement"`, aparece um novo estágio de geração de QA antes de `"commit"`.
3. Ao concluir, chamar `GET /api/v1/demands/:demandId/qa/test-cases` (ou abrir a aba/tela correspondente no frontend) e confirmar:
   - pelo menos 1 `TestCase` com `scenario: "POSITIVE"`;
   - pelo menos 1 `TestCase` com `scenario: "NEGATIVE"`;
   - se a demanda tocou uma API protegida, pelo menos 1 com `scenario: "AUTHORIZATION"` e 1 com `"AUTHENTICATION"`.
4. Confirmar que nenhum `FunctionalTestExecution` foi criado (a geração, por si só, nunca executa — spec FR-004).

**Expected outcome**: Test Cases disponíveis para consulta, sem nenhuma execução ter ocorrido (spec SC-001, SC-002).

## Cenário 2 — configuração desabilitada por padrão

1. Criar um Projeto novo (ou usar um existente) e confirmar, via `GET /api/v1/projects/:id`, que `qaAutoExecutionEnabled` vem `false` sem nenhuma configuração manual.
2. Repetir o Cenário 1 nesse Projeto e confirmar que o comportamento (gera, não executa) é idêntico.

**Expected outcome**: nenhuma execução ocorre com a configuração no padrão (spec SC-002).

## Cenário 3 — falha genuína bloqueia o Commit

1. Provocar um erro real na etapa de geração de QA (ex.: derrubar temporariamente o provider de LLM usado, ou um erro de rede simulável em ambiente de teste).
2. Confirmar que a `AgentExecution` termina `FAILED` com o erro registrado, e que **nenhum commit** ocorre nos repositórios dos artefatos da demanda (mesmo comportamento já validado nesta sessão para o Test Gate existente).

**Expected outcome**: falha genuína bloqueia o avanço (spec FR-003, Clarification #3) — diferente de "nenhum cenário aplicável" (que não bloqueia, ver Edge Cases da spec).

## Cenário 4 — controle de acesso

1. Com um usuário que NÃO tem `QA_READ`, chamar `GET /api/v1/demands/:demandId/qa/test-cases` e confirmar **403**.
2. Com um usuário que tem `QA_READ` mas não `QA_EXECUTE`, confirmar que consegue listar Test Cases mas (quando a Fase 3/4 existir) não consegue disparar execução funcional.

**Expected outcome**: as duas permissões novas (`QA_READ`, `QA_EXECUTE`) funcionam de forma independente, conforme desenhado na Clarification #1.
