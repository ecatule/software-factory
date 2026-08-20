import type { PrismaService } from "../../common/prisma/prisma.service";
import { classifyScenario, extractTestCasesFromSpec, QaGenerationService } from "./qa-generation.service";

const SAMPLE_SPEC = `# Feature Specification: Exemplo

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login (Priority: P1) 🎯 MVP

Usuário faz login no sistema.

**Why this priority**: núcleo da feature.

**Independent Test**: pode ser testado isoladamente.

**Acceptance Scenarios**:

1. **Given** um usuário com credenciais válidas, **When** ele envia o formulário de login, **Then** ele é autenticado e redirecionado ao painel.
2. **Given** um usuário sem token de autenticação, **When** ele tenta acessar uma rota protegida, **Then** o sistema retorna 401 e bloqueia o acesso.

---

### User Story 2 - Permissões (Priority: P2)

Usuário sem permissão não pode executar ações administrativas.

**Why this priority**: segurança.

**Independent Test**: pode ser testado isoladamente.

**Acceptance Scenarios**:

1. **Given** um usuário sem permissão de administrador, **When** ele tenta acessar o painel administrativo, **Then** o sistema retorna 403 e nega o acesso.

---

### Edge Cases

- O que acontece se o usuário enviar um e-mail malformado? O sistema deve rejeitar o formulário com uma mensagem de erro clara, sem chamar a API.
- O que acontece se a fila de notificação estiver indisponível?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE autenticar usuários.
`;

// spec User Story 1 (formato real de demanda de cliente, Especificação
// Assistida / specification_copilot) — excerto adaptado do spec.md real da
// demanda "Faturamento Automático com/sem carteirinha" verificado ao vivo.
const SAMPLE_ESPECIFICACAO_ASSISTIDA = `# Parametrização do Faturamento Automático

## Contexto

Atualmente, o processo de geração de cobrança precisa considerar carteirinha.

## Requisitos Funcionais

### RF-001 — Considerar parametrização do calendário

O processo de geração de cobrança deve consultar o campo \`geracaoFaturamentoComCarteirinha\` configurado na regra de calendário de cobrança.

### RF-002 — Faturamento condicionado à carteirinha

Quando \`geracaoFaturamentoComCarteirinha\` estiver configurado como \`Sim\`, a geração da cobrança deverá considerar a existência de algum benefício do titular do contrato com identificação de carteirinha.

A informação de carteirinha deverá ser obtida por meio do campo \`BeneficioContrato.numeroCartaoIdentificacao\`.

## Regras de Negócio

### RN-001 — Regra de parametrização

A decisão sobre a necessidade de carteirinha deverá ser determinada pelo campo \`geracaoFaturamentoComCarteirinha\` da regra de calendário de cobrança.
`;

/** spec User Story 1 (research.md decisão 9): extração via parser do spec.md, sem LLM. */
describe("extractTestCasesFromSpec", () => {
  it("extracts one TestCase per Acceptance Scenario, across multiple User Stories", () => {
    const cases = extractTestCasesFromSpec(SAMPLE_SPEC);
    const acceptanceCases = cases.filter((c) => !c.title.startsWith("Edge Case:"));
    expect(acceptanceCases).toHaveLength(3);
  });

  it("maps Given/When/Then to preconditions/steps/expectedResult", () => {
    const [first] = extractTestCasesFromSpec(SAMPLE_SPEC);
    expect(first.preconditions).toBe("um usuário com credenciais válidas");
    expect(first.steps).toBe("ele envia o formulário de login");
    expect(first.expectedResult).toBe("ele é autenticado e redirecionado ao painel.");
  });

  it("classifies scenarios by keyword (positive/authentication/authorization)", () => {
    const cases = extractTestCasesFromSpec(SAMPLE_SPEC);
    expect(cases[0].scenario).toBe("POSITIVE");
    expect(cases[1].scenario).toBe("AUTHENTICATION");
    expect(cases[2].scenario).toBe("AUTHORIZATION");
  });

  it("carries the User Story's Priority as criticality (P1 -> HIGH, P2 -> MEDIUM)", () => {
    const cases = extractTestCasesFromSpec(SAMPLE_SPEC);
    expect(cases[0].criticality).toBe("HIGH");
    expect(cases[2].criticality).toBe("MEDIUM");
  });

  it("also extracts Edge Cases bullets as test cases", () => {
    const cases = extractTestCasesFromSpec(SAMPLE_SPEC);
    const edgeCases = cases.filter((c) => c.title.startsWith("Edge Case:"));
    expect(edgeCases).toHaveLength(2);
    expect(edgeCases[0].steps).toContain("e-mail malformado");
    expect(edgeCases[0].expectedResult).toContain("mensagem de erro");
  });

  it("stops collecting once it reaches a '## ' section after Edge Cases (e.g. Requirements)", () => {
    const cases = extractTestCasesFromSpec(SAMPLE_SPEC);
    expect(cases.some((c) => c.steps.includes("FR-001"))).toBe(false);
  });

  it("returns an empty array for a spec with no Acceptance Scenarios/Edge Cases", () => {
    expect(extractTestCasesFromSpec("# Feature\n\nSem nada de estruturado aqui.")).toEqual([]);
  });
});

/** formato real de demanda de cliente (Especificação Assistida) — sem Given/When/Then, prosa em RF-XXX/RN-XXX. */
describe("extractTestCasesFromSpec — formato Especificação Assistida (RF/RN)", () => {
  it("extracts one TestCase per RF/RN requirement", () => {
    const cases = extractTestCasesFromSpec(SAMPLE_ESPECIFICACAO_ASSISTIDA);
    expect(cases).toHaveLength(3);
    expect(cases.map((c) => c.title)).toEqual([
      "RF-001: Considerar parametrização do calendário",
      "RF-002: Faturamento condicionado à carteirinha",
      "RN-001: Regra de parametrização",
    ]);
  });

  it("uses the requirement's own body as expectedResult", () => {
    const [first] = extractTestCasesFromSpec(SAMPLE_ESPECIFICACAO_ASSISTIDA);
    expect(first.expectedResult).toContain("consultar o campo");
    expect(first.type).toBe("FUNCTIONAL");
    expect(first.automatable).toBe(false);
  });

  it("joins multi-paragraph bodies into a single expectedResult", () => {
    const [, second] = extractTestCasesFromSpec(SAMPLE_ESPECIFICACAO_ASSISTIDA);
    expect(second.expectedResult).toContain("existência de algum benefício");
    expect(second.expectedResult).toContain("BeneficioContrato.numeroCartaoIdentificacao");
  });

  it("extracts a 'Quando ..., ' clause as preconditions when present", () => {
    const [, second] = extractTestCasesFromSpec(SAMPLE_ESPECIFICACAO_ASSISTIDA);
    expect(second.preconditions).toContain("configurado como");
  });

  it("leaves preconditions undefined when there is no 'Quando ..., ' clause", () => {
    const [first] = extractTestCasesFromSpec(SAMPLE_ESPECIFICACAO_ASSISTIDA);
    expect(first.preconditions).toBeUndefined();
  });

  it("extracts RN- (Regra de Negócio) requirements the same way as RF-", () => {
    const cases = extractTestCasesFromSpec(SAMPLE_ESPECIFICACAO_ASSISTIDA);
    const rn = cases.find((c) => c.title.startsWith("RN-001"));
    expect(rn?.expectedResult).toContain("determinada pelo campo");
  });
});

describe("classifyScenario", () => {
  it.each([
    ["usuário sem token de autenticação", "AUTHENTICATION"],
    ["acesso negado por falta de permissão", "AUTHORIZATION"],
    ["mensagem publicada na fila de integração", "INTEGRATION"],
    ["não pode quebrar funcionalidade existente", "REGRESSION"],
    ["dados inválidos enviados pelo usuário", "NEGATIVE"],
    ["usuário realiza a ação com sucesso", "POSITIVE"],
  ])("classifies %s as %s", (text, expected) => {
    expect(classifyScenario(text)).toBe(expected);
  });
});

/** spec FR-003/FR-004: geração nunca executa nada; falha genuína (sem spec.md) é distinta de "nada encontrado". */
describe("QaGenerationService", () => {
  function build() {
    const testCaseCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "test-case-1", ...data }),
      );
    const functionalTestExecutionCreate = jest.fn();
    const auditLogCreate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      db: {
        testCase: { create: testCaseCreate },
        functionalTestExecution: { create: functionalTestExecutionCreate },
        auditLog: { create: auditLogCreate },
      },
    } as unknown as PrismaService;
    const service = new QaGenerationService(prisma);
    return { service, testCaseCreate, functionalTestExecutionCreate, auditLogCreate };
  }

  it("persists one TestCase per extracted scenario and never creates a FunctionalTestExecution (spec FR-004)", async () => {
    const { service, testCaseCreate, functionalTestExecutionCreate } = build();

    const result = await service.generateTestCases({
      demandId: "demand-1",
      executionId: "execution-1",
      specContent: SAMPLE_SPEC,
    });

    expect(result.generated).toBe(5);
    expect(testCaseCreate).toHaveBeenCalledTimes(5);
    expect(functionalTestExecutionCreate).not.toHaveBeenCalled();
  });

  it("persists zero test cases without throwing when the spec has nothing structured, and still records it in AuditLog", async () => {
    const { service, testCaseCreate, auditLogCreate } = build();

    const result = await service.generateTestCases({
      demandId: "demand-1",
      executionId: "execution-1",
      specContent: "# Feature\n\nSem nada estruturado.",
    });

    expect(result.generated).toBe(0);
    expect(testCaseCreate).not.toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "QA_TEST_CASES_GENERATED" }),
    });
  });

  it("throws — a genuine failure — when there is no spec.md content at all (spec FR-003)", async () => {
    const { service, testCaseCreate, auditLogCreate } = build();

    await expect(
      service.generateTestCases({ demandId: "demand-1", executionId: "execution-1", specContent: undefined }),
    ).rejects.toThrow();
    expect(testCaseCreate).not.toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "QA_GENERATION_FAILED" }),
    });
  });
});
