import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { Artifact, PaginatedResult } from "./types";

export interface Repository {
  id: string;
  projectId: string;
  externalReference: string;
}

export function useRepositoriesList(page: number) {
  return useQuery({
    queryKey: ["repositories", { page }],
    queryFn: () => apiGet<PaginatedResult<Repository>>(`/repositories?page=${page}&page_size=20`),
  });
}

export function useRepositoryArtifacts(repositoryId: string | null) {
  return useQuery({
    queryKey: ["repository", repositoryId, "artifacts"],
    queryFn: () => apiGet<Artifact[]>(`/repositories/${repositoryId}/artifacts`),
    enabled: repositoryId !== null,
  });
}
