import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { Execution } from "./useExecutions";

export interface Agent {
  id: string;
  name: string;
  type: string;
}

export function useAgentsList() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => apiGet<Agent[]>("/agents"),
  });
}

export interface TriggerExecutionInput {
  agentId: string;
  demandId: string;
  pipelineStage?: string;
}

export function useTriggerExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TriggerExecutionInput) => apiPost<Execution>("/executions", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}
