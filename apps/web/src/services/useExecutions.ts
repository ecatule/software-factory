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
