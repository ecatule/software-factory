import type { LLMProvider, LLMRequest, LLMResponse } from "@software-factory/domain";

interface ClaudeConfig {
  apiKey: string;
  model?: string;
}

/**
 * spec FR-008: the second initial LLMProvider implementation, selectable per
 * pipeline stage independently of ChatGPTProvider.
 */
export class ClaudeProvider implements LLMProvider {
  constructor(private readonly config: ClaudeConfig) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model ?? "claude-sonnet-5",
        max_tokens: 4096,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.prompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as { content: { text: string }[] };
    return { content: json.content?.[0]?.text ?? "", raw: json };
  }

  async generateStructured<T>(request: LLMRequest): Promise<T> {
    const { content } = await this.generate(request);
    return JSON.parse(content) as T;
  }
}
