import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { Artifact, PaginatedResult } from "./types";

export interface ArtifactFile {
  id: string;
  filePath: string;
  changeType: "MODIFIED" | "ADDED" | "REMOVED" | "DISCOVERED";
  reason: string | null;
}

/** display labels for `Artifact.status` — underlying value (sent/filtered on) stays untouched. */
export const ARTIFACT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planejado",
  IMPLEMENTED: "Implementado",
};

export function artifactStatusLabel(status: string): string {
  return ARTIFACT_STATUS_LABELS[status] ?? status;
}

/** display labels for `ArtifactFile.changeType`. */
export const CHANGE_TYPE_LABELS: Record<ArtifactFile["changeType"], string> = {
  MODIFIED: "Modificado",
  ADDED: "Adicionado",
  REMOVED: "Removido",
  DISCOVERED: "Descoberto",
};

export function changeTypeLabel(changeType: ArtifactFile["changeType"]): string {
  return CHANGE_TYPE_LABELS[changeType] ?? changeType;
}

export function useArtifactsList(page: number) {
  return useQuery({
    queryKey: ["artifacts", { page }],
    queryFn: () =>
      apiGet<PaginatedResult<Artifact>>(`/artifacts?page=${page}&page_size=20`),
  });
}

export function useArtifactFiles(artifactId: string | null) {
  return useQuery({
    queryKey: ["artifact", artifactId, "files"],
    queryFn: () => apiGet<ArtifactFile[]>(`/artifacts/${artifactId}/files`),
    enabled: artifactId !== null,
  });
}

export interface CreateArtifactInput {
  demandId: string;
  name: string;
  type: string;
  description?: string;
  technology?: string;
  path?: string;
  repositoryIds?: string[];
}

/** feature 004 US6: exposes the demand-scoped POST that has existed, unused by any form, since 001. */
export function useCreateArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandId, ...input }: CreateArtifactInput) =>
      apiPost<Artifact>(`/demands/${demandId}/artifacts`, input),
    onSuccess: (_data, { demandId }) => {
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      queryClient.invalidateQueries({ queryKey: ["demand", demandId, "artifacts"] });
    },
  });
}
