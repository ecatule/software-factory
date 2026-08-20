/**
 * feature 006 (pipeline configurável): ordem real das 9 etapas do branch
 * "developer" em `ExecutionsProcessor` — única fonte de verdade, usada
 * tanto pelo processor (decidir o que pular ao retomar de uma etapa
 * manual) quanto por `PipelineConfigService` (ordenar a listagem pra tela
 * "Configuração do Pipeline" na ordem de execução, não alfabética).
 */
export const DEVELOPER_STAGE_ORDER = [
  "branches",
  "cloning",
  "safety-check",
  "tasks",
  "analyze",
  "checklist",
  "implement",
  "qa-generation",
  "commit",
] as const;
