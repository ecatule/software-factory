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

export function useBranchesList(page: number) {
  return useQuery({
    queryKey: ["branches", { page }],
    queryFn: () => apiGet<PaginatedResult<BranchItem>>(`/branches?page=${page}&page_size=20`),
  });
}

export function useCommitsList(page: number) {
  return useQuery({
    queryKey: ["commits", { page }],
    queryFn: () => apiGet<PaginatedResult<CommitItem>>(`/commits?page=${page}&page_size=20`),
  });
}

export function usePullRequestsList(page: number) {
  return useQuery({
    queryKey: ["pull-requests", { page }],
    queryFn: () =>
      apiGet<PaginatedResult<PullRequestItem>>(`/pull-requests?page=${page}&page_size=20`),
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

/** manual "create pull request" trigger — Agentes screen. */
export function useCreatePullRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (demandId: string) => apiPost<PullRequestItem>(`/demands/${demandId}/pull-request`),
    meta: { successMessage: "Pull Request criado." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pull-requests"] }),
  });
}
