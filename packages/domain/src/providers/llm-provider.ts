export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  raw?: unknown;
}

/**
 * spec FR-008: reached only from apps/api services or BullMQ workers, never
 * from apps/web — this is the AI Agent Boundary principle enforced by module
 * boundaries. Selectable per pipeline stage via ProviderConfiguration.
 */
export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
  generateStructured<T>(request: LLMRequest): Promise<T>;
}

export const LLM_PROVIDER = Symbol("LLM_PROVIDER");
