import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { TestExecutionInput, TestExecutionOutput, TestExecutorProvider } from "@software-factory/domain";

/**
 * Resolved relative to this compiled file, same reasoning as
 * `WORKSPACE_ROOT`/`PROJECT_ENV_CONFIG_DIR` in apps/api — never
 * `process.cwd()`. Override with `TEST_EVIDENCE_DIR` for deployments where
 * this file's location relative to the repo root differs.
 */
const EVIDENCE_STORAGE_DIR =
  process.env.TEST_EVIDENCE_DIR ?? path.resolve(__dirname, "../../../../evidence-storage");

/**
 * spec FR-011 (User Story 3): executor para `TestCase.type === "UI"` —
 * primeira dependência real de Playwright no monorepo.
 *
 * Known limitation (documented, not silently pretended away): `TestCase.steps`
 * é texto livre em markdown (data-model.md), não um script estruturado — este
 * executor NÃO interpreta os passos automaticamente (isso exigiria um agente
 * de IA controlando o browser, um escopo maior que esta rodada). O que ele
 * faz de verdade: navega até `environment.applicationUrl`, captura uma
 * evidência real (screenshot) e reporta PASS/FAIL conforme a página carregar
 * ou não — um smoke check real, não uma execução completa do roteiro do
 * Caso de Teste. Evidência salva localmente (`EVIDENCE_STORAGE_DIR`), não em
 * `StorageProvider` (interface existe em packages/domain, mas nenhuma
 * implementação concreta existia neste monorepo até agora — fora do escopo
 * resolver isso aqui, dado que esta é a integração Playwright em si).
 */
export class BrowserTestExecutorProvider implements TestExecutorProvider {
  supports(testCaseType: string): boolean {
    return testCaseType === "UI";
  }

  async execute(input: TestExecutionInput): Promise<TestExecutionOutput> {
    const { testCase, environment } = input;

    if (!environment.applicationUrl) {
      return { status: "BLOCKED", error: "No applicationUrl configured for this environment", evidences: [] };
    }

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      let navigationError: string | undefined;
      try {
        const response = await page.goto(environment.applicationUrl, { waitUntil: "load", timeout: 30_000 });
        if (!response || !response.ok()) {
          navigationError = `Navigation returned status ${response?.status() ?? "unknown"}`;
        }
      } catch (error) {
        navigationError = error instanceof Error ? error.message : String(error);
      }

      const screenshotRef = await this.captureScreenshot(page, testCase.id).catch(() => undefined);
      await page.close();

      return {
        status: navigationError ? "FAIL" : "PASS",
        error: navigationError,
        evidences: screenshotRef ? [{ type: "screenshot", storageRef: screenshotRef }] : [],
      };
    } finally {
      await browser.close();
    }
  }

  private async captureScreenshot(
    page: import("playwright").Page,
    testCaseId: string,
  ): Promise<string> {
    await mkdir(EVIDENCE_STORAGE_DIR, { recursive: true });
    const fileName = `${testCaseId}-${Date.now()}.png`;
    const filePath = path.join(EVIDENCE_STORAGE_DIR, fileName);
    const buffer = await page.screenshot({ fullPage: true });
    await writeFile(filePath, buffer);
    return filePath;
  }
}
