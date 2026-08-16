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

/** display labels for `Increment.status` — underlying value stays untouched. */
export const INCREMENT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  COMPLETED: "Concluído",
};

export function incrementStatusLabel(status: string): string {
  return INCREMENT_STATUS_LABELS[status] ?? status;
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
