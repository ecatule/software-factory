import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { Specification } from "./types";

export function useSpecification(specificationId: string) {
  return useQuery({
    queryKey: ["specification", specificationId],
    queryFn: () => apiGet<Specification>(`/specifications/${specificationId}`),
  });
}

/** feature 003 (data-model.md "Extended: SpecificationVersion"). */
export type SpecificationVersionStatus =
  | "DRAFT"
  | "GENERATED"
  | "REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";
export type SpecificationVersionSource = "AI" | "HUMAN_EDITED" | "UPLOADED";

export interface SpecificationVersion {
  id: string;
  specificationId: string;
  versionNumber: number;
  content: string;
  authorUserId: string | null;
  agentId: string | null;
  reason: string | null;
  createdAt: string;
  incrementId: string | null;
  status: SpecificationVersionStatus;
  source: SpecificationVersionSource;
  llmModel: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalComment: string | null;
  changeSummary: {
    rulesAdded: string[];
    artifactsImpacted: string[];
    apisImpacted: string[];
    dataImpacted: string[];
    suggestedTests: string[];
  } | null;
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
    mutationFn: (input: { content: string; reason: string; incrementId?: string }) =>
      apiPost<SpecificationVersion>(`/specifications/${specificationId}/versions`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["specification", specificationId, "versions"] }),
  });
}

export function useApproveSpecificationVersion(specificationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionNumber, comment }: { versionNumber: number; comment?: string }) =>
      apiPost<SpecificationVersion>(
        `/specifications/${specificationId}/versions/${versionNumber}/approve`,
        { comment },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["specification", specificationId, "versions"] }),
  });
}

/** follow-up: uploading may create a version on the SIBLING (SPEC/PLAN) document too — invalidate broadly so "Outros documentos" picks up its new currentVersionId. */
export function useUploadSpecificationVersion(specificationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { specifyMarkdown?: string; planMarkdown?: string; reason?: string }) =>
      apiPost<SpecificationVersion[]>(`/specifications/${specificationId}/versions/upload`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specification", specificationId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["demand"] });
    },
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

/** follow-up: discard a version the analyst decided not to approve — the backend blocks this once APPROVED. */
export function useDeactivateSpecificationVersion(specificationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionNumber: number) =>
      apiPost<{ deactivated: boolean }>(
        `/specifications/${specificationId}/versions/${versionNumber}/deactivate`,
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
