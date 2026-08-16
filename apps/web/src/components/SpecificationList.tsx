import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "../services/api";
import type { Specification } from "../services/types";

interface Props {
  demandId: string;
  specifications?: Specification[];
}

const DOCUMENT_TYPES = ["SPEC", "PLAN"] as const;

interface Row {
  documentType: string;
  spec: Specification | null;
}

/**
 * spec 001 User Story 5: which SDD documents exist for this demand so far.
 * feature 003 (live-validation finding): a brand-new demand has none yet —
 * offer to start one (lazily creates the Specification container, spec
 * User Story 1 Acceptance Scenario 1) instead of a dead end.
 */
export function SpecificationList({ demandId, specifications }: Props) {
  const navigate = useNavigate();
  const existingTypes = new Set((specifications ?? []).map((s) => s.documentType));

  async function start(documentType: string) {
    const spec = await apiPost<Specification>(
      `/demands/${demandId}/specifications/${documentType}/ensure`,
    );
    navigate(`/specifications/${spec.id}`);
  }

  const rows: Row[] = [
    ...(specifications ?? []).map((spec) => ({ documentType: spec.documentType, spec })),
    ...DOCUMENT_TYPES.filter((t) => !existingTypes.has(t)).map((documentType) => ({ documentType, spec: null })),
  ];

  const columns: ColumnDef<Row, unknown>[] = [
    { header: "Documento", accessorKey: "documentType" },
    { header: "Versão", cell: ({ row }) => (row.original.spec?.currentVersionId ? "atual" : "nenhuma") },
    {
      header: "Ações",
      cell: ({ row }) =>
        row.original.spec ? (
          // spec 002 User Story 8 / 003 User Story 1: open the Especificação Assistida workspace.
          <Button type="button" variant="ghost" size="icon" title="Abrir no editor" aria-label="Abrir no editor" asChild>
            <Link to={`/specifications/${row.original.spec.id}`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => start(row.original.documentType)}>
            Iniciar
          </Button>
        ),
    },
  ];

  return <DataTable columns={columns} data={rows} emptyMessage="Nenhum documento ainda." />;
}
