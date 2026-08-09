import type { LLMProvider, LLMRequest, LLMResponse } from "@software-factory/domain";

interface ChatGptConfig {
  apiKey: string;
  model?: string;
}

/**
 * spec FR-008: one of the two initial LLMProvider implementations. Called
 * only from apps/api services/workers (AI Agent Boundary) — never from
 * apps/web.
 */
export class ChatGPTProvider implements LLMProvider {
  constructor(private readonly config: ChatGptConfig) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model ?? "gpt-4o-mini",
        messages: [
          ...(request.systemPrompt
            ? [{ role: "system", content: request.systemPrompt }]
            : []),
          { role: "user", content: request.prompt },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`ChatGPT API error: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return { content: json.choices[0]?.message?.content ?? "", raw: json };
  }

  async generateStructured<T>(request: LLMRequest): Promise<T> {
    const { content } = await this.generate(request);
    return JSON.parse(content) as T;
  }
}
