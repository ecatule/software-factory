import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";

export type GmudEnvironment = "HOMOLOGACAO" | "PRODUCAO";

export interface GmudRequest {
  id: string;
  demandId: string;
  environment: GmudEnvironment;
  mondayItemId: string;
  mondayItemUrl: string;
  createdAt: string;
}

export const GMUD_ENVIRONMENT_LABELS: Record<GmudEnvironment, string> = {
  HOMOLOGACAO: "Homologação",
  PRODUCAO: "Produção",
};

export function useGmudRequestsForDemand(demandId: string | null) {
  return useQuery({
    queryKey: ["gmud-requests", demandId],
    queryFn: () => apiGet<GmudRequest[]>(`/governance/gmud?demandId=${demandId}`),
    enabled: demandId !== null,
  });
}

export interface GmudArtifactPreview {
  id: string;
  name: string;
  description: string | null;
}

/** every artifact the demand ever selected (all rounds/incrementos), not just the current selection — matches what `useCreateGmudRequest` actually sends. */
export function useGmudArtifactsPreview(demandId: string | null) {
  return useQuery({
    queryKey: ["gmud-artifacts-preview", demandId],
    queryFn: () => apiGet<GmudArtifactPreview[]>(`/governance/gmud/artifacts?demandId=${demandId}`),
    enabled: demandId !== null,
  });
}

export function useCreateGmudRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { demandId: string; environment: GmudEnvironment }) =>
      apiPost<GmudRequest>("/governance/gmud", input),
    meta: { successMessage: "GMUD aberta no Monday." },
    onSuccess: (_data, { demandId }) =>
      queryClient.invalidateQueries({ queryKey: ["gmud-requests", demandId] }),
  });
}
