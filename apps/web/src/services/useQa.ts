import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";

export interface TestCase {
  id: string;
  demandId: string;
  artifactId: string | null;
  title: string;
  type: string;
  scenario: string;
  preconditions: string | null;
  data: unknown;
  steps: string;
  expectedResult: string;
  criticality: string | null;
  automatable: boolean;
  generatedByExecutionId: string | null;
  createdAt: string;
}

/** display labels for `TestCase.scenario` — the value sent/stored stays untouched. */
export const TEST_CASE_SCENARIO_LABELS: Record<string, string> = {
  POSITIVE: "Positivo",
  NEGATIVE: "Negativo",
  AUTHORIZATION: "Autorização",
  AUTHENTICATION: "Autenticação",
  INTEGRATION: "Integração",
  REGRESSION: "Regressão",
};

export function testCaseScenarioLabel(scenario: string): string {
  return TEST_CASE_SCENARIO_LABELS[scenario] ?? scenario;
}

/** feature 006 (contracts/qa-test-cases.md): geração acontece automaticamente no pipeline — esta tela só lê o que já foi gerado. */
export function useTestCasesList(demandId: string) {
  return useQuery({
    queryKey: ["demand", demandId, "qa", "test-cases"],
    queryFn: () => apiGet<TestCase[]>(`/demands/${demandId}/qa/test-cases`),
    enabled: !!demandId,
  });
}

export interface FunctionalTestExecution {
  id: string;
  testCaseId: string;
  demandId: string;
  environment: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: "NOT_EXECUTED" | "RUNNING" | "PASS" | "FAIL" | "BLOCKED";
  error: string | null;
}

/** display labels for `FunctionalTestExecution.status` — the value sent/stored stays untouched. */
export const FUNCTIONAL_TEST_STATUS_LABELS: Record<string, string> = {
  NOT_EXECUTED: "Não executado",
  RUNNING: "Em execução",
  PASS: "Passou",
  FAIL: "Falhou",
  BLOCKED: "Bloqueado",
};

export function functionalTestStatusLabel(status: string): string {
  return FUNCTIONAL_TEST_STATUS_LABELS[status] ?? status;
}

export interface TestEvidenceItem {
  id: string;
  functionalTestExecutionId: string;
  type: string;
  storageRef: string | null;
  content: string | null;
}

export interface FunctionalTestExecutionWithEvidences extends FunctionalTestExecution {
  evidences: TestEvidenceItem[];
}

/** feature 006 (User Story 4): histórico de execuções funcionais + evidências. */
export function useFunctionalTestsList(demandId: string) {
  return useQuery({
    queryKey: ["demand", demandId, "qa", "functional-tests"],
    queryFn: () => apiGet<FunctionalTestExecutionWithEvidences[]>(`/demands/${demandId}/qa/functional-tests`),
    enabled: !!demandId,
  });
}

/**
 * feature 006 (User Story 3, contracts/qa-functional-testing.md): dispara a
 * execução funcional real, protegida pelo Environment Guard — requer
 * `QA_EXECUTE`. Omitido/vazio = todos os Casos de Teste automatizáveis.
 */
export function useRunFunctionalTests(demandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testCaseIds?: string[]) =>
      apiPost<FunctionalTestExecution[]>(`/demands/${demandId}/qa/functional-tests/run`, { testCaseIds }),
    meta: { successMessage: "Execução funcional disparada." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["demand", demandId, "qa"] }),
  });
}
