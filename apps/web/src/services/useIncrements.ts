import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";

export interface Increment {
  id: string;
  demandId: string;
  number: number;
  title: string | null;
  reason: string;
  status: string;
  baseSpecificationVersionId: string | null;
}

export function useIncrementsList(demandId: string) {
  return useQuery({
    queryKey: ["demand", demandId, "increments"],
    queryFn: () => apiGet<Increment[]>(`/demands/${demandId}/increments`),
    enabled: !!demandId,
  });
}

export function useCreateIncrement(demandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; title?: string }) =>
      apiPost<Increment>(`/demands/${demandId}/increments`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["demand", demandId, "increments"] }),
  });
}
