import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api";
import type { Client } from "./types";

export function useClientsList() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<Client[]>("/clients"),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; externalReference?: string }) =>
      apiPost<Client>("/clients", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; externalReference?: string }) =>
      apiPatch<Client>(`/clients/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}
