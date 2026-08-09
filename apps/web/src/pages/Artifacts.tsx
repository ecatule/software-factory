import { useState } from "react";
import { DataTable, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useArtifactFiles, useArtifactsList } from "../services/useArtifacts";
import type { Artifact } from "../services/types";

/** spec User Story 7: browse artifacts across demands. */
export function Artifacts() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useArtifactsList(page);
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  const { data: files } = useArtifactFiles(openArtifactId);

  const columns: ColumnDef<Artifact, unknown>[] = [
    { header: "Name", accessorKey: "name" },
    { header: "Type", accessorKey: "type" },
    { header: "Technology", accessorKey: "technology" },
    { header: "Status", cell: ({ row }) => <Badge label={row.original.status} /> },
  ];

  return (
    <div className="artifacts-page">
      <h1>Artifacts</h1>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(artifact) => setOpenArtifactId(artifact.id)}
        emptyMessage="No artifacts identified yet."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Artifact files" isOpen={openArtifactId !== null} onClose={() => setOpenArtifactId(null)}>
        <ul>
          {files?.map((f) => (
            <li key={f.id}>
              {f.filePath} — {f.changeType}
              {f.changeType === "DISCOVERED" && f.reason ? ` (${f.reason})` : null}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
