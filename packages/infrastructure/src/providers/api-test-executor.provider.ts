import type { TestExecutionInput, TestExecutionOutput, TestExecutorProvider } from "@software-factory/domain";

interface ApiTestCaseData {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus?: number;
}

const MAX_RESPONSE_BODY_CHARS = 5_000;

/**
 * spec FR-011 (User Story 3): executa Casos de Teste do tipo "API" contra o
 * `apiUrl` real de homologação — status HTTP, payload, headers,
 * autenticação/autorização, conforme o Caso de Teste definir.
 * `TestCase.data` é lido no formato descrito no system prompt de
 * `QaGenerationService`: `{method, path, headers?, body?, expectedStatus}`.
 */
export class ApiTestExecutorProvider implements TestExecutorProvider {
  supports(testCaseType: string): boolean {
    return testCaseType === "API";
  }

  async execute(input: TestExecutionInput): Promise<TestExecutionOutput> {
    const { testCase, environment } = input;
    const data = (testCase.data as ApiTestCaseData | undefined) ?? {};

    if (!environment.apiUrl) {
      return { status: "BLOCKED", error: "No apiUrl configured for this environment", evidences: [] };
    }
    if (!data.path) {
      return {
        status: "BLOCKED",
        error: 'Test case "data" is missing a "path" — cannot execute automatically',
        evidences: [],
      };
    }

    const method = (data.method ?? "GET").toUpperCase();
    const url = new URL(data.path, environment.apiUrl).toString();
    const requestHeaders = { "content-type": "application/json", ...data.headers };

    let response: Response;
    let responseBody: string;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: data.body !== undefined ? JSON.stringify(data.body) : undefined,
      });
      responseBody = await response.text();
    } catch (error) {
      return {
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error),
        evidences: [{ type: "request", content: JSON.stringify({ method, url, headers: requestHeaders }) }],
      };
    }

    const expectedStatus = data.expectedStatus;
    const passed = expectedStatus === undefined || response.status === expectedStatus;

    return {
      status: passed ? "PASS" : "FAIL",
      error: passed ? undefined : `Expected status ${expectedStatus}, got ${response.status}`,
      evidences: [
        {
          type: "request",
          content: JSON.stringify({ method, url, headers: requestHeaders, body: data.body }),
        },
        {
          type: "response",
          content: JSON.stringify({
            status: response.status,
            body: responseBody.slice(0, MAX_RESPONSE_BODY_CHARS),
          }),
        },
      ],
    };
  }
}
