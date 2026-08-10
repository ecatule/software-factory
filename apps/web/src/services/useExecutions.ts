import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { PaginatedResult } from "./types";

export interface Execution {
  id: string;
  agentId: string;
  demandId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: string | null;
  finishedAt: string | null;
  input: unknown;
  output: unknown;
  error: string | null;
}

export function useExecutionsList(page: number, status?: string) {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (status) params.set("status", status);
  return useQuery({
    queryKey: ["executions", { page, status }],
    queryFn: () => apiGet<PaginatedResult<Execution>>(`/executions?${params.toString()}`),
  });
}

/** feature 003 (research.md §10): polls a single execution, same POLL_INTERVAL_MS convention as useDemandPolling. */
const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export function useExecution(id: string | null) {
  return useQuery({
    queryKey: ["execution", id],
    queryFn: () => apiGet<Execution>(`/executions/${id}`),
    enabled: id !== null,
    refetchInterval: (query) =>
      query.state.data && TERMINAL_STATUSES.has(query.state.data.status) ? false : POLL_INTERVAL_MS,
  });
}
