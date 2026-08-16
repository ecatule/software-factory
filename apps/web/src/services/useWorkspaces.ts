import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { DemandWorkspace, PaginatedResult } from "./types";

/** display labels for `DemandWorkspace.status` — underlying value stays untouched. */
export const WORKSPACE_STATUS_LABELS: Record<string, string> = {
  CREATED: "Criado",
};

export function workspaceStatusLabel(status: string): string {
  return WORKSPACE_STATUS_LABELS[status] ?? status;
}

export function useWorkspacesList(page: number, demandId?: string) {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (demandId) params.set("demand_id", demandId);
  return useQuery({
    queryKey: ["workspaces", { page, demandId }],
    queryFn: () => apiGet<PaginatedResult<DemandWorkspace>>(`/workspaces?${params.toString()}`),
  });
}

export interface WorkspaceTree {
  spec: string[];
  artefatos: { artifact: string; files: string[] }[];
}

export function useWorkspaceTree(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace", workspaceId, "tree"],
    queryFn: () => apiGet<WorkspaceTree>(`/workspaces/${workspaceId}/tree`),
    enabled: workspaceId !== null,
  });
}
