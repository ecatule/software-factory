import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { PaginatedResult } from "./types";

export interface ArtifactRef {
  id: string;
  name: string;
  type: string;
}
export interface BranchItem {
  id: string;
  name: string;
  demandId: string;
  repositoryId: string;
  artifact: ArtifactRef | null;
}
export interface CommitItem {
  id: string;
  sha: string;
  demandId: string;
  artifact: ArtifactRef | null;
}
export interface PullRequestItem {
  id: string;
  externalReference: string;
  demandId: string;
  status: string;
  url: string | null;
  artifact: ArtifactRef | null;
}

/** display labels for `PullRequest.status` — the value sent/stored (e.g. filters, API params) stays untouched. */
export const PR_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  MERGED: "Integrado",
  CLOSED: "Fechado",
};

export function prStatusLabel(status: string): string {
  return PR_STATUS_LABELS[status] ?? status;
}

export interface GitActivityFilters {
  demandId?: string;
}

export function useBranchesList(page: number, filters: GitActivityFilters = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (filters.demandId) params.set("demand_id", filters.demandId);
  return useQuery({
    queryKey: ["branches", { page, ...filters }],
    queryFn: () => apiGet<PaginatedResult<BranchItem>>(`/branches?${params.toString()}`),
  });
}

export function useCommitsList(page: number, filters: GitActivityFilters = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (filters.demandId) params.set("demand_id", filters.demandId);
  return useQuery({
    queryKey: ["commits", { page, ...filters }],
    queryFn: () => apiGet<PaginatedResult<CommitItem>>(`/commits?${params.toString()}`),
  });
}

export function usePullRequestsList(
  page: number,
  filters: GitActivityFilters & { status?: string } = {},
) {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (filters.demandId) params.set("demand_id", filters.demandId);
  if (filters.status) params.set("status", filters.status);
  return useQuery({
    queryKey: ["pull-requests", { page, ...filters }],
    queryFn: () => apiGet<PaginatedResult<PullRequestItem>>(`/pull-requests?${params.toString()}`),
  });
}

export interface CommitAllResult {
  artifactId: string;
  sha?: string;
  error?: string;
  skipped?: true;
}

/** manual "commit + push everything pending" trigger — Agentes screen. */
export function useCommitAllArtifacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (demandId: string) => apiPost<CommitAllResult[]>(`/demands/${demandId}/commit-all`),
    meta: { successMessage: "Commit e push processados." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commits"] }),
  });
}

export interface CreatePullRequestResult {
  artifactId: string;
  pullRequestId?: string;
  externalReference?: string;
  error?: string;
  skipped?: true;
}

/**
 * manual "create pull request" trigger — Agentes screen. One PR per
 * eligible artifact/repo, not just the demand's first one. `artifactIds`
 * lets the caller narrow it down to specific artifacts (e.g. only the ones
 * touched by the current increment) — omitted/empty keeps the original
 * "every eligible artifact" behavior.
 */
export function useCreatePullRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandId, artifactIds }: { demandId: string; artifactIds?: string[] }) =>
      apiPost<CreatePullRequestResult[]>(`/demands/${demandId}/pull-request`, { artifactIds }),
    meta: { successMessage: "Pull Requests processados." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pull-requests"] }),
  });
}

/** "Sincronizar" row action — Atividade do Git screen. Re-fetches a single PR's status/URL from GitHub. */
export function useSyncPullRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pullRequestId: string) => apiPost<PullRequestItem>(`/pull-requests/${pullRequestId}/sync`),
    meta: { successMessage: "Pull Request sincronizado." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pull-requests"] }),
  });
}
