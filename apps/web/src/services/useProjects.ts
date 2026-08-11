import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api";
import type { Project } from "./types";

export function useProjectsList(clientId?: string) {
  return useQuery({
    queryKey: ["projects", { clientId }],
    queryFn: () => apiGet<Project[]>(`/projects${clientId ? `?client_id=${clientId}` : ""}`),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      clientId: string;
      name: string;
      technologies?: string[];
      requiredTestSuites?: string[];
    }) => apiPost<Project>("/projects", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      technologies?: string[];
      branchNamingPolicy?: string;
      requiredTestSuites?: string[];
      constitution?: string;
    }) => apiPatch<Project>(`/projects/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}
