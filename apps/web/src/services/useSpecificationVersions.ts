import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";

export interface SpecificationVersion {
  id: string;
  specificationId: string;
  versionNumber: number;
  content: string;
  authorUserId: string | null;
  agentId: string | null;
  reason: string | null;
  createdAt: string;
}

export function useSpecificationVersionsList(specificationId: string) {
  return useQuery({
    queryKey: ["specification", specificationId, "versions"],
    queryFn: () => apiGet<SpecificationVersion[]>(`/specifications/${specificationId}/versions`),
  });
}

export function useCreateSpecificationVersion(specificationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; reason: string }) =>
      apiPost<SpecificationVersion>(`/specifications/${specificationId}/versions`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["specification", specificationId, "versions"] }),
  });
}

export function useRestoreSpecificationVersion(specificationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionNumber: number) =>
      apiPost<SpecificationVersion>(
        `/specifications/${specificationId}/versions/${versionNumber}/restore`,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["specification", specificationId, "versions"] }),
  });
}

export function useSpecificationDiff(
  specificationId: string,
  versionA: number | null,
  versionB: number | null,
) {
  return useQuery({
    queryKey: ["specification", specificationId, "diff", versionA, versionB],
    queryFn: () =>
      apiGet<{ additions: string[]; deletions: string[] }>(
        `/specifications/${specificationId}/versions/${versionA}/diff/${versionB}`,
      ),
    enabled: versionA !== null && versionB !== null,
  });
}
