import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { Demand, PaginatedResult } from "./types";

export interface DemandFilters {
  clientId?: string;
  projectId?: string;
  status?: string;
  /** feature 004 FR-014 — comma-separated list of statuses (e.g. Dashboard bucket click-through). */
  statusIn?: string;
  type?: string;
  agentId?: string;
  agentStatus?: string;
  prStatus?: string;
  hasFailingTests?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(filters: DemandFilters): string {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("client_id", filters.clientId);
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.statusIn) params.set("status_in", filters.statusIn);
  if (filters.type) params.set("type", filters.type);
  if (filters.agentId) params.set("agent_id", filters.agentId);
  if (filters.agentStatus) params.set("agent_status", filters.agentStatus);
  if (filters.prStatus) params.set("pr_status", filters.prStatus);
  if (filters.hasFailingTests) params.set("has_failing_tests", "true");
  if (filters.createdAfter) params.set("created_after", filters.createdAfter);
  if (filters.createdBefore) params.set("created_before", filters.createdBefore);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 20));
  return params.toString();
}

/** feature 004 FR-013: enrichment fields added to each list item. */
export interface EnrichedDemand extends Demand {
  clientName: string;
  projectName: string;
  currentIncrement: { number: number; status: string } | null;
  currentAgent: { name: string } | null;
  latestPullRequest: { externalReference: string; status: string } | null;
}

export function useDemandsList(filters: DemandFilters) {
  return useQuery({
    queryKey: ["demands", filters],
    queryFn: () => apiGet<PaginatedResult<EnrichedDemand>>(`/demands?${buildQuery(filters)}`),
  });
}

export function useImportDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { externalId: string; clientId: string; projectId: string }) =>
      apiPost<Demand>("/demands/import", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["demands"] }),
  });
}

export function useDemand(id: string) {
  return useQuery({
    queryKey: ["demand", id],
    queryFn: () => apiGet<Demand>(`/demands/${id}`),
    enabled: !!id,
  });
}

export interface CreateDemandInput {
  externalId: string;
  origin: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  clientId: string;
  projectId: string;
}

export function useCreateDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDemandInput) => apiPost<Demand>("/demands", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["demands"] }),
  });
}
