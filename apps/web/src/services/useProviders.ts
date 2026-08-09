import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "./api";
import type { PaginatedResult } from "./types";

export interface Provider {
  id: string;
  key: string;
  kind: string;
}

export interface ProviderConfiguration {
  id: string;
  providerId: string;
  projectId: string | null;
  pipelineStage: string | null;
  settings: Record<string, unknown>;
}

export function useProvidersList() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => apiGet<Provider[]>("/providers"),
  });
}

export function useProviderConfigurations(providerId: string | null) {
  return useQuery({
    queryKey: ["provider", providerId, "configurations"],
    queryFn: () =>
      apiGet<PaginatedResult<ProviderConfiguration>>(
        `/providers/${providerId}/configurations`,
      ),
    enabled: providerId !== null,
  });
}

export interface SaveConfigurationInput {
  providerId: string;
  projectId?: string;
  pipelineStage?: string;
  settings: Record<string, unknown>;
}

export function useSaveProviderConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, ...input }: SaveConfigurationInput) =>
      apiPost<ProviderConfiguration>(`/providers/${providerId}/configurations`, input),
    onSuccess: (_, { providerId }) =>
      queryClient.invalidateQueries({ queryKey: ["provider", providerId, "configurations"] }),
  });
}

export { ApiError };
