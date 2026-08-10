import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "./api";
import type { Artifact, PaginatedResult } from "./types";

export interface Repository {
  id: string;
  projectId: string;
  externalReference: string;
  /** feature 004 FR-002. */
  productionBranch: string | null;
  homologationBranch: string | null;
}

export function useRepositoriesList(page: number) {
  return useQuery({
    queryKey: ["repositories", { page }],
    queryFn: () => apiGet<PaginatedResult<Repository>>(`/repositories?page=${page}&page_size=20`),
  });
}

export function useUpdateRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      productionBranch?: string;
      homologationBranch?: string;
    }) => apiPatch<Repository>(`/repositories/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

export function useRepositoryArtifacts(repositoryId: string | null) {
  return useQuery({
    queryKey: ["repository", repositoryId, "artifacts"],
    queryFn: () => apiGet<Artifact[]>(`/repositories/${repositoryId}/artifacts`),
    enabled: repositoryId !== null,
  });
}
