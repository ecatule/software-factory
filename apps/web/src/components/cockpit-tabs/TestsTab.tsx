import { useState } from "react";
import { Badge, DataTable, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  testStatusLabel,
  useDemandTests,
  useRunDemandTests,
  type TestExecution,
} from "../../services/useDemandTests";

interface Props {
  demandId: string;
}

function columns(onViewError: (test: TestExecution) => void): ColumnDef<TestExecution, unknown>[] {
  return [
    { header: "Suíte", accessorKey: "suite" },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge
          label={testStatusLabel(row.original.status)}
          tone={row.original.status === "FAILED" ? "danger" : row.original.status === "PASSED" ? "success" : "neutral"}
        />
      ),
    },
    {
      header: "Resultado",
      cell: ({ row }) =>
        row.original.result
          ? `${row.original.result.passedCount} passaram, ${row.original.result.failedCount} falharam, ${row.original.result.skippedCount} ignorados`
          : "—",
    },
    {
      header: "Ações",
      cell: ({ row }) =>
        row.original.error && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Ver erro"
            aria-label="Ver erro"
            className="text-destructive hover:text-destructive"
            onClick={() => onViewError(row.original)}
          >
            <AlertCircle className="size-4" />
          </Button>
        ),
    },
  ];
}

/** feature 004 US5: per-demand test executions, previously only reachable via the cross-demand Tests page. */
export function TestsTab({ demandId }: Props) {
  const { data: tests, isLoading } = useDemandTests(demandId);
  const runTests = useRunDemandTests(demandId);
  const [viewingError, setViewingError] = useState<TestExecution | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Testes</h2>
      <Button type="button" onClick={() => runTests.mutate()} disabled={runTests.isPending} className="self-start">
        <PlayCircle /> Rodar testes
      </Button>
      <DataTable
        columns={columns(setViewingError)}
        data={tests ?? []}
        isLoading={isLoading}
        emptyMessage="Nenhuma execução de teste ainda."
      />

      <Modal
        title={viewingError ? `Erro — ${viewingError.suite}` : "Erro"}
        isOpen={viewingError !== null}
        onClose={() => setViewingError(null)}
      >
        <pre className="overflow-x-auto rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {viewingError?.error}
        </pre>
      </Modal>
    </div>
  );
}
