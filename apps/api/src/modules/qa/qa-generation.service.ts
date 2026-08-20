import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

const USER_STORY_HEADER = /^### User Story \d+ - (.+?) \(Priority: (P\d)\)/;
const EDGE_CASES_HEADER = /^### Edge Cases/;
const SECTION_HEADER = /^## /;
const SUBSECTION_HEADER = /^### /;
const GIVEN_WHEN_THEN = /\*\*Given\*\*\s*(.+?),\s*\*\*When\*\*\s*(.+?),\s*\*\*Then\*\*\s*(.+)/;
const EDGE_CASE_BULLET = /^-\s+(.+)/;
// feature 006 (Especificação Assistida / specification_copilot): formato real
// de demanda de cliente — prosa em português, sem Given/When/Then, ex.:
// "### RF-001 — Considerar parametrização do calendário".
const REQUIREMENT_HEADER = /^### (RF|RN)-(\d+)\s*[—–-]\s*(.+)/;
const WHEN_CLAUSE = /Quando\s+(.+?),/i;

const PRIORITY_CRITICALITY: Record<string, string> = { P1: "HIGH", P2: "MEDIUM", P3: "LOW" };

export interface ParsedTestCase {
  title: string;
  type: string;
  scenario: string;
  preconditions?: string;
  steps: string;
  expectedResult: string;
  criticality?: string;
  automatable: boolean;
}

export interface GenerateTestCasesInput {
  demandId: string;
  executionId: string;
  specContent?: string;
}

export interface GenerateTestCasesResult {
  generated: number;
}

/**
 * spec User Story 1 (FR-002/FR-005, atualizado — ver research.md decisão 9):
 * classificação por palavra-chave sobre o texto Given/When/Then (ou o
 * Edge Case inteiro) — heurística, não uma análise semântica real. É uma
 * limitação conhecida e documentada, não escondida: só reconhece o que já
 * está escrito de forma razoavelmente explícita no spec.md.
 */
export function classifyScenario(text: string): string {
  const lower = text.toLowerCase();
  if (/(401|não autenticad|sem token|sem autenticaç)/.test(lower)) return "AUTHENTICATION";
  if (/(403|sem permissão|não autorizad|acesso negado)/.test(lower)) return "AUTHORIZATION";
  if (/(banco de dados|fila|webhook|serviço externo|gateway|integraç)/.test(lower)) return "INTEGRATION";
  if (/(regressão|funcionalidade existente|impact)/.test(lower)) return "REGRESSION";
  if (/(inválid|errad|falha|bloque|rejeitad|não reconhecid|nunca)/.test(lower)) return "NEGATIVE";
  return "POSITIVE";
}

interface PendingRequirement {
  id: string;
  title: string;
  bodyLines: string[];
}

/**
 * spec User Story 1 (research.md decisão 9): extrai Casos de Teste
 * DIRETAMENTE do que já foi escrito e aprovado no `spec.md` — sem nenhuma
 * chamada de LLM. Reconhece DOIS formatos reais desta plataforma:
 *
 * 1. `/speckit-specify` (meta-desenvolvimento da própria plataforma) — User
 *    Story / Acceptance Scenarios (Given/When/Then) / Edge Cases.
 * 2. "Especificação Assistida" (`specification_copilot`, o fluxo real usado
 *    por toda demanda de cliente) — prosa em português, sem Given/When/Then:
 *    `### RF-XXX — título` (Requisito Funcional) / `### RN-XXX — título`
 *    (Regra de Negócio), corpo em texto livre.
 *
 * Cobertura limitada ao que já está escrito: se um cenário de
 * autorização/integração/regressão não foi redigido explicitamente ali
 * (Acceptance Scenario, Edge Case, ou corpo de um RF/RN), ele não vira
 * Caso de Teste — FR-005 passa a valer "quando já presente no spec.md",
 * não "sempre que aplicável" via análise independente.
 */
export function extractTestCasesFromSpec(specContent: string): ParsedTestCase[] {
  const lines = specContent.split("\n");
  const cases: ParsedTestCase[] = [];

  let currentStoryTitle: string | undefined;
  let currentCriticality: string | undefined;
  let inEdgeCases = false;
  let scenarioIndex = 0;
  let pendingRequirement: PendingRequirement | undefined;

  const flushRequirement = () => {
    if (!pendingRequirement) return;
    const body = pendingRequirement.bodyLines.join(" ").replace(/\s+/g, " ").trim();
    if (body) {
      const whenMatch = WHEN_CLAUSE.exec(body);
      cases.push({
        title: `${pendingRequirement.id}: ${pendingRequirement.title}`,
        type: "FUNCTIONAL",
        scenario: classifyScenario(body),
        preconditions: whenMatch ? whenMatch[1].trim() : undefined,
        steps: `Executar o fluxo coberto por ${pendingRequirement.id} (${pendingRequirement.title}) e observar o comportamento do sistema.`,
        expectedResult: body,
        automatable: false,
      });
    }
    pendingRequirement = undefined;
  };

  for (const line of lines) {
    const storyMatch = USER_STORY_HEADER.exec(line);
    if (storyMatch) {
      flushRequirement();
      currentStoryTitle = storyMatch[1].trim();
      currentCriticality = PRIORITY_CRITICALITY[storyMatch[2]];
      inEdgeCases = false;
      scenarioIndex = 0;
      continue;
    }
    if (EDGE_CASES_HEADER.test(line)) {
      flushRequirement();
      inEdgeCases = true;
      currentStoryTitle = undefined;
      continue;
    }
    const requirementMatch = REQUIREMENT_HEADER.exec(line);
    if (requirementMatch) {
      flushRequirement();
      inEdgeCases = false;
      currentStoryTitle = undefined;
      const [, prefix, number, title] = requirementMatch;
      pendingRequirement = { id: `${prefix}-${number}`, title: title.trim(), bodyLines: [] };
      continue;
    }
    if (SECTION_HEADER.test(line)) {
      // left the current "## ..." section entirely (e.g. reached "## Success Criteria")
      flushRequirement();
      inEdgeCases = false;
      currentStoryTitle = undefined;
      continue;
    }
    if (SUBSECTION_HEADER.test(line)) {
      // some other "### ..." subsection not recognized above (e.g. "### Key Entities")
      flushRequirement();
      inEdgeCases = false;
      currentStoryTitle = undefined;
      continue;
    }

    if (currentStoryTitle) {
      const match = GIVEN_WHEN_THEN.exec(line);
      if (match) {
        scenarioIndex += 1;
        const [, given, when, then] = match;
        cases.push({
          title: `${currentStoryTitle} — cenário ${scenarioIndex}`,
          type: "FUNCTIONAL",
          scenario: classifyScenario(`${given} ${when} ${then}`),
          preconditions: given.trim(),
          steps: when.trim(),
          expectedResult: then.trim(),
          criticality: currentCriticality,
          automatable: false,
        });
      }
      continue;
    }

    if (inEdgeCases) {
      const bulletMatch = EDGE_CASE_BULLET.exec(line);
      if (bulletMatch) {
        const text = bulletMatch[1].trim();
        const [question, ...rest] = text.split("?");
        const expectedResult = rest.join("?").trim();
        cases.push({
          title: `Edge Case: ${question.trim().slice(0, 80)}`,
          type: "FUNCTIONAL",
          scenario: classifyScenario(text),
          steps: `${question.trim()}?`,
          expectedResult: expectedResult || "Ver descrição completa do Edge Case no spec.md",
          automatable: false,
        });
      }
      continue;
    }

    if (pendingRequirement && line.trim()) {
      pendingRequirement.bodyLines.push(line.trim());
    }
  }

  flushRequirement();

  return cases;
}

/**
 * spec User Story 1 (FR-001 a FR-005): chamado pelo `ExecutionsProcessor`
 * logo após o `implement` (fluxo automático) ou isoladamente pela tela
 * Agentes (backfill manual) — gera os Casos de Teste da demanda a partir
 * do `spec.md` já aprovado, e NUNCA executa nada (FR-004): esta classe
 * deliberadamente nunca referencia `TEST_EXECUTOR_PROVIDER` nem cria
 * `FunctionalTestExecution`.
 */
@Injectable()
export class QaGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  async generateTestCases(input: GenerateTestCasesInput): Promise<GenerateTestCasesResult> {
    if (!input.specContent?.trim()) {
      await this.recordAudit(input.demandId, "QA_GENERATION_FAILED", {
        message: "No spec.md content available to extract test cases from",
      });
      throw new Error("QA Agent has no spec.md content to extract test cases from — refusing to persist.");
    }

    const items = extractTestCasesFromSpec(input.specContent);

    const created = await Promise.all(
      items.map((item) =>
        this.prisma.db.testCase.create({
          data: {
            demandId: input.demandId,
            title: item.title,
            type: item.type,
            scenario: item.scenario,
            preconditions: item.preconditions,
            steps: item.steps,
            expectedResult: item.expectedResult,
            criticality: item.criticality,
            automatable: item.automatable,
            generatedByExecutionId: input.executionId,
          },
        }),
      ),
    );

    // spec Edge Cases: mesmo com `generated: 0` (spec.md sem Acceptance
    // Scenarios/Edge Cases reconhecíveis), este registro em AuditLog é a
    // sinalização explícita exigida — nunca pulamos a etapa silenciosamente.
    await this.recordAudit(input.demandId, "QA_TEST_CASES_GENERATED", {
      generated: created.length,
      byScenario: this.countByScenario(items),
    });

    return { generated: created.length };
  }

  private countByScenario(items: ParsedTestCase[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.scenario] = (counts[item.scenario] ?? 0) + 1;
    }
    return counts;
  }

  /**
   * follow-up: mesmo padrão de `developer-agent.service.ts`
   * (`PRE_IMPLEMENT_AUTO_SANITIZED`/`PRE_IMPLEMENT_SAFETY_BLOCK`) — escrita
   * explícita porque este método roda dentro do worker BullMQ, fora do
   * ciclo request/response que o `AuditInterceptor` global cobre.
   */
  private async recordAudit(demandId: string, action: string, after: object): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: { action, entityType: "demands", entityId: demandId, after, correlationId: randomUUID() },
    });
  }
}
