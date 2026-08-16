import { DataTable } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useWorkspaceTree } from "../../services/useWorkspaces";
import type { DemandWorkspace } from "../../services/types";
import { WorkspaceTree } from "../WorkspaceTree";

interface Props {
  workspace?: DemandWorkspace | null;
}

const specColumns: ColumnDef<string, unknown>[] = [{ header: "Arquivo", cell: ({ row }) => row.original }];

interface ArtefatoRow {
  artifact: string;
  fileCount: number;
}
const artefatoColumns: ColumnDef<ArtefatoRow, unknown>[] = [
  { header: "Artefato", accessorKey: "artifact" },
  { header: "Arquivos", accessorKey: "fileCount" },
];

/** feature 004 US5: the demand's workspace — where the Developer Agent checks out and works. */
export function DevelopmentTab({ workspace }: Props) {
  const { data: tree } = useWorkspaceTree(workspace?.id ?? null);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Desenvolvimento</h2>
      <WorkspaceTree workspace={workspace} />

      {tree && (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">spec/</h3>
            <DataTable columns={specColumns} data={tree.spec} emptyMessage="Nenhum arquivo em spec/." />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">artefatos/</h3>
            <DataTable
              columns={artefatoColumns}
              data={tree.artefatos.map((a) => ({ artifact: a.artifact, fileCount: a.files.length }))}
              emptyMessage="Nenhum artefato em artefatos/."
            />
          </div>
        </>
      )}
    </div>
  );
}
