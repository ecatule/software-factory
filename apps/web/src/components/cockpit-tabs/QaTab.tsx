import { useState } from "react";
import { Badge, DataTable } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import {
  functionalTestStatusLabel,
  testCaseScenarioLabel,
  useFunctionalTestsList,
  useRunFunctionalTests,
  useTestCasesList,
  type TestCase,
} from "../../services/useQa";

interface Props {
  demandId: string;
}

const SCENARIO_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  POSITIVE: "success",
  NEGATIVE: "danger",
  AUTHORIZATION: "warning",
  AUTHENTICATION: "warning",
  INTEGRATION: "neutral",
  REGRESSION: "neutral",
};

const FUNCTIONAL_TEST_STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  PASS: "success",
  FAIL: "danger",
  BLOCKED: "warning",
  RUNNING: "neutral",
  NOT_EXECUTED: "neutral",
};

function columns(
  selected: Set<string>,
  toggle: (id: string) => void,
  canExecute: boolean,
): ColumnDef<TestCase, unknown>[] {
  const base: ColumnDef<TestCase, unknown>[] = [
    { header: "Título", accessorKey: "title" },
    { header: "Tipo", accessorKey: "type" },
    {
      header: "Cenário",
      cell: ({ row }) => (
        <Badge
          label={testCaseScenarioLabel(row.original.scenario)}
          tone={SCENARIO_TONE[row.original.scenario] ?? "neutral"}
        />
      ),
    },
    { header: "Criticidade", cell: ({ row }) => row.original.criticality ?? "—" },
    { header: "Automatizável", cell: ({ row }) => (row.original.automatable ? "Sim" : "Não") },
  ];

  if (!canExecute) return base;

  return [
    {
      header: "",
      id: "select",
      cell: ({ row }) =>
        row.original.automatable && (
          <input
            type="checkbox"
            checked={selected.has(row.original.id)}
            onChange={() => toggle(row.original.id)}
            aria-label={`Selecionar ${row.original.title}`}
          />
        ),
    },
    ...base,
  ];
}

/**
 * feature 006 (User Story 1/3): geração é automática no pipeline, entre
 * `implement` e `commit` — a lista de Casos de Teste é só leitura. A
 * execução funcional (seleção + botão) requer `QA_EXECUTE`.
 */
export function QaTab({ demandId }: Props) {
  const { hasPermission } = useAuth();
  const { data: testCases, isLoading } = useTestCasesList(demandId);
  const { data: functionalTests } = useFunctionalTestsList(demandId);
  const runTests = useRunFunctionalTests(demandId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canExecute = hasPermission("QA_EXECUTE");
  const testCaseTitleById = new Map((testCases ?? []).map((tc) => [tc.id, tc.title] as const));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">QA — Casos de Teste</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Gerados automaticamente pelo Agente QA logo após a implementação, antes do commit — nenhuma
            execução acontece nesta etapa.
          </p>
        </div>
        {canExecute && (
          <Button
            type="button"
            onClick={() => runTests.mutate(selected.size > 0 ? [...selected] : undefined)}
            disabled={runTests.isPending}
          >
            <PlayCircle /> Rodar testes funcionais
          </Button>
        )}
      </div>
      <DataTable
        columns={columns(selected, toggle, canExecute)}
        data={testCases ?? []}
        isLoading={isLoading}
        emptyMessage="Nenhum Caso de Teste gerado ainda para esta demanda."
      />
      {runTests.isError && (
        <p className="text-sm font-medium text-destructive">
          {runTests.error instanceof Error ? runTests.error.message : "Falha ao disparar a execução funcional."}
        </p>
      )}

      {!!functionalTests?.length && (
        <div className="mt-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Histórico de execuções funcionais</h2>
          <ul className="flex flex-col gap-2">
            {functionalTests.map((execution) => (
              <li key={execution.id} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {testCaseTitleById.get(execution.testCaseId) ?? execution.testCaseId}
                  </span>
                  <Badge
                    label={functionalTestStatusLabel(execution.status)}
                    tone={FUNCTIONAL_TEST_STATUS_TONE[execution.status] ?? "neutral"}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {execution.environment}
                  {execution.error ? ` — ${execution.error}` : ""}
                </span>
                {execution.evidences.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Evidências: {execution.evidences.map((ev) => ev.type).join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
