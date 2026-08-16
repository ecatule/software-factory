import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";

export interface TestExecution {
  id: string;
  suite: string;
  status: "RUNNING" | "PASSED" | "FAILED";
  durationMs: number | null;
  output: string | null;
  error: string | null;
  result: { passedCount: number; failedCount: number; skippedCount: number } | null;
}

/** display labels for `TestExecution.status` — underlying value stays untouched. */
export const TEST_STATUS_LABELS: Record<TestExecution["status"], string> = {
  RUNNING: "Em execução",
  PASSED: "Passou",
  FAILED: "Falhou",
};

export function testStatusLabel(status: TestExecution["status"]): string {
  return TEST_STATUS_LABELS[status] ?? status;
}

export function useDemandTests(demandId: string | null) {
  return useQuery({
    queryKey: ["demand", demandId, "tests"],
    queryFn: () => apiGet<TestExecution[]>(`/demands/${demandId}/tests`),
    enabled: demandId !== null,
  });
}

export function useRunDemandTests(demandId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<TestExecution[]>(`/demands/${demandId}/tests/run`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["demand", demandId, "tests"] }),
  });
}
