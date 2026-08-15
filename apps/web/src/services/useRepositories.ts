import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api";
import type { Artifact, PaginatedResult } from "./types";

export interface Repository {
  id: string;
  projectId: string;
  externalReference: string;
  /** feature 004 FR-002. */
  productionBranch: string | null;
  homologationBranch: string | null;
  stAtivo: boolean;
}

export function useRepositoriesList(page: number) {
  return useQuery({
    queryKey: ["repositories", { page }],
    queryFn: () => apiGet<PaginatedResult<Repository>>(`/repositories?page=${page}&page_size=20`),
  });
}

/** follow-up: registers the git address (`owner/repo`) a Project's Developer Agent clones/branches/commits/opens PRs against — previously only insertable directly in the database. */
export function useCreateRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      externalReference: string;
      productionBranch?: string;
      homologationBranch?: string;
    }) => apiPost<Repository>("/repositories", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

/** follow-up: `externalReference` is now editable too — Repository is the single place to manage a repo's address and both branches together. */
export function useUpdateRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      projectId?: string;
      externalReference?: string;
      productionBranch?: string;
      homologationBranch?: string;
      stAtivo?: boolean;
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
