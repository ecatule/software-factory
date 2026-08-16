import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
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
