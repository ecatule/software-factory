import { useMutation } from "@tanstack/react-query";
import { apiPost } from "./api";

/** feature 005 User Story 4 (contracts/prompt-generation.md): no LLM call, pure string building on the backend. */
export function useGeneratePromptSpec(demandId: string) {
  return useMutation({
    mutationFn: (input: { business: string; technical: string }) =>
      apiPost<{ prompt: string }>(`/demands/${demandId}/prompt-spec`, input),
  });
}
