import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { PaginatedResult } from "./types";

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  occurredAt: string;
}

export interface AuditFilters {
  entityType?: string;
  from?: string;
  to?: string;
  page?: number;
  /** feature 004 US5: lets callers (e.g. the Cockpit Audit tab) skip the request entirely without AUDIT_READ. */
  enabled?: boolean;
}

export function useAuditList(filters: AuditFilters) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), page_size: "20" });
  if (filters.entityType) params.set("entity_type", filters.entityType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return useQuery({
    queryKey: ["audits", filters],
    queryFn: () => apiGet<PaginatedResult<AuditLogEntry>>(`/audits?${params.toString()}`),
    enabled: filters.enabled ?? true,
  });
}
