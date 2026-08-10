import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiPut } from "./api";
import type { PaginatedResult } from "./types";

export interface Technology {
  id: string;
  name: string;
  category: string;
  techVersion: string | null;
  description: string | null;
  status: string;
}

export function useTechnologiesList() {
  return useQuery({
    queryKey: ["technologies"],
    queryFn: () => apiGet<PaginatedResult<Technology>>("/technologies?page_size=100"),
  });
}

export function useCreateTechnology() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Technology, "id">) => apiPost<Technology>("/technologies", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["technologies"] }),
  });
}

export function useUpdateTechnology() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<Technology> & { id: string }) =>
      apiPatch<Technology>(`/technologies/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["technologies"] }),
  });
}

export function useProjectTechnologies(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "technologies"],
    queryFn: () => apiGet<Technology[]>(`/projects/${projectId}/technologies`),
    enabled: !!projectId,
  });
}

export function useSetProjectTechnologies(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (technologyIds: string[]) =>
      apiPut<Technology[]>(`/projects/${projectId}/technologies`, { technologyIds }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "technologies"] }),
  });
}
