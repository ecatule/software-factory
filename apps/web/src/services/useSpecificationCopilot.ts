import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { Agent } from "./useAgents";
import type { Execution } from "./useExecutions";

const SPECIFICATION_COPILOT_AGENT_TYPE = "specification_copilot";

export interface SpecificationCopilotInput {
  business: Record<string, unknown>;
  technical: Record<string, unknown>;
}

async function resolveCopilotAgentId(): Promise<string> {
  const agents = await apiGet<Agent[]>("/agents");
  const agent = agents.find((a) => a.type === SPECIFICATION_COPILOT_AGENT_TYPE);
  if (!agent) {
    throw new Error(
      `No agent of type "${SPECIFICATION_COPILOT_AGENT_TYPE}" found — was the database seeded?`,
    );
  }
  return agent.id;
}

/**
 * spec User Story 1 / research.md §1: triggers an async AI-assisted
 * specification round for a demand, reusing the existing `POST /executions`
 * endpoint (agent catalog row seeded as "SpecificationCopilotAgent").
 */
export function useTriggerSpecificationRound(demandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SpecificationCopilotInput) => {
      const agentId = await resolveCopilotAgentId();
      return apiPost<Execution>("/executions", { agentId, demandId, input });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}
