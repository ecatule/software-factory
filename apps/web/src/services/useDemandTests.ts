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
