import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { PaginatedResult } from "./types";

/** written by the backend's global ErrorLogFilter — see error-log.filter.ts. */
export interface ErrorLogEntry {
  id: string;
  occurredAt: string;
  method: string;
  url: string;
  statusCode: number;
  message: string;
  stack: string | null;
  exceptionName: string | null;
  correlationId: string;
  actorUserId: string | null;
  isHttpException: boolean;
}

export interface ErrorLogFilters {
  statusCode?: number;
  correlationId?: string;
  from?: string;
  to?: string;
  page?: number;
}

export function useErrorLogList(filters: ErrorLogFilters) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), page_size: "20" });
  if (filters.statusCode) params.set("status_code", String(filters.statusCode));
  if (filters.correlationId) params.set("correlation_id", filters.correlationId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return useQuery({
    queryKey: ["error-logs", filters],
    queryFn: () => apiGet<PaginatedResult<ErrorLogEntry>>(`/error-logs?${params.toString()}`),
  });
}
