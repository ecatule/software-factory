import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { Artifact, PaginatedResult } from "./types";

export interface ArtifactFile {
  id: string;
  filePath: string;
  changeType: "MODIFIED" | "ADDED" | "REMOVED" | "DISCOVERED";
  reason: string | null;
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
