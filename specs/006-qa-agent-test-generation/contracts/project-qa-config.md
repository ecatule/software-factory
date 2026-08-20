# Contract: Configuração de Execução Automática por Projeto

Implements spec FR-008, FR-009 (User Story 5).

## `PATCH /api/v1/projects/:id` (existing endpoint, DTO estendido)

- **Body**: adiciona `qaAutoExecutionEnabled?: boolean` ao `UpdateProjectDto` já existente — mesmo padrão de `requiredTestSuites?: string[]`.
- **200**: `Project` atualizado.
- Requires a mesma permissão já usada por este endpoint hoje (escrita de Projeto) — nenhuma permissão nova para este campo especificamente, é só mais um campo do mesmo recurso.

## `GET /api/v1/projects` / `GET /api/v1/projects/:id` (existing, sem mudança de contrato)

`qaAutoExecutionEnabled` passa a vir no payload já retornado por esses endpoints (campo novo do model, sem `select` restritivo hoje).

## UI (Fase 1)

`apps/web/src/pages/Projects.tsx` ganha um checkbox "Execução automática de testes habilitada" no mesmo formulário de criar/editar Projeto, ao lado do campo já existente "Suítes de teste obrigatórias" — mesma tela, mesmo padrão.

## Comportamento (spec FR-008/FR-009)

Enquanto `qaAutoExecutionEnabled: false` (padrão): Test Cases são gerados, armazenados e disponibilizados normalmente (Fase 1) — nenhuma execução automática ocorre em nenhum ponto do pipeline. Alterar para `true` é sempre uma ação explícita nesta tela — nenhuma outra ação do sistema muda esse valor como efeito colateral.
