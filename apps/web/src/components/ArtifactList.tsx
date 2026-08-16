import { useState } from "react";
import { DataTable, Badge, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { artifactStatusLabel, changeTypeLabel, useArtifactFiles } from "../services/useArtifacts";
import type { Artifact } from "../services/types";

interface Props {
  artifacts?: Artifact[];
}

function columns(onViewFiles: (artifact: Artifact) => void): ColumnDef<Artifact, unknown>[] {
  return [
    { header: "Nome", accessorKey: "name" },
    { header: "Tipo", accessorKey: "type" },
    { header: "Tecnologia", accessorKey: "technology" },
    { header: "Status", cell: ({ row }) => <Badge label={artifactStatusLabel(row.original.status)} /> },
    {
      header: "Ações",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Ver arquivos"
          aria-label="Ver arquivos"
          onClick={() => onViewFiles(row.original)}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ];
}

/** spec User Story 5: each artifact's status shown alongside the cockpit — "Ver arquivos" reuses the same files-list modal as the cross-demand Artifacts page. */
export function ArtifactList({ artifacts }: Props) {
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);
  const { data: files } = useArtifactFiles(viewingArtifact?.id ?? null);

  return (
    <>
      <DataTable
        columns={columns(setViewingArtifact)}
        data={artifacts ?? []}
        emptyMessage="Nenhum artefato identificado ainda."
      />

      <Modal
        title={viewingArtifact ? `Arquivos — ${viewingArtifact.name}` : "Arquivos"}
        isOpen={viewingArtifact !== null}
        onClose={() => setViewingArtifact(null)}
      >
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {files?.map((f) => (
            <li key={f.id}>
              {f.filePath} — {changeTypeLabel(f.changeType)}
              {f.changeType === "DISCOVERED" && f.reason ? ` (${f.reason})` : null}
            </li>
          ))}
          {!files?.length && <li className="text-muted-foreground">Nenhum arquivo registrado ainda.</li>}
        </ul>
      </Modal>
    </>
  );
}
