import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { Demand, PaginatedResult } from "./types";

export interface DemandFilters {
  clientId?: string;
  projectId?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(filters: DemandFilters): string {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("client_id", filters.clientId);
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 20));
  return params.toString();
}

export function useDemandsList(filters: DemandFilters) {
  return useQuery({
    queryKey: ["demands", filters],
    queryFn: () => apiGet<PaginatedResult<Demand>>(`/demands?${buildQuery(filters)}`),
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
