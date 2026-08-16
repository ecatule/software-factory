import { DataTable, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { prStatusLabel } from "../services/useGitActivity";
import type { Artifact, GitActivity as GitActivityData } from "../services/types";

interface Props {
  activity?: GitActivityData;
  artifacts?: Artifact[];
}

// Explicit `size` (px) on the shared columns below — same technique as
// apps/web/src/pages/GitActivity.tsx: lets `DataTable` line these columns up
// across the three separate Branches/Commits/Pull Requests tables (each is
// its own <table>, so this only works because every grid declares the exact
// same widths for the columns they have in common).
const ARTIFACT_COLUMN_SIZE = 260;
const TYPE_COLUMN_SIZE = 140;

function artifactColumns<T extends { artifactId: string | null }>(
  artifactById: Map<string, Artifact>,
): ColumnDef<T, unknown>[] {
  return [
    {
      header: "Artefato",
      size: ARTIFACT_COLUMN_SIZE,
      cell: ({ row }) => artifactById.get(row.original.artifactId ?? "")?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Tipo",
      size: TYPE_COLUMN_SIZE,
      cell: ({ row }) => {
        const artifact = artifactById.get(row.original.artifactId ?? "");
        return artifact ? <Badge label={artifact.type} /> : null;
      },
    },
  ];
}

/** spec User Story 9: branch, commits, PR status visible per demand — same Artefato/Tipo column pattern as the cross-demand Git Activity page, joined client-side against `artifacts` (already fetched by the cockpit for the Artefatos tab). */
export function GitActivity({ activity, artifacts }: Props) {
  const artifactById = new Map((artifacts ?? []).map((a) => [a.id, a] as const));

  if (!activity) return <p className="text-sm text-muted-foreground">Nenhuma atividade do Git ainda.</p>;

  const branchColumns: ColumnDef<GitActivityData["branches"][number], unknown>[] = [
    { header: "Branch", accessorKey: "name" },
    ...artifactColumns<GitActivityData["branches"][number]>(artifactById),
  ];
  const commitColumns: ColumnDef<GitActivityData["commits"][number], unknown>[] = [
    { header: "SHA", cell: ({ row }) => row.original.sha.slice(0, 8) },
    ...artifactColumns<GitActivityData["commits"][number]>(artifactById),
  ];
  const pullRequestColumns: ColumnDef<GitActivityData["pull_requests"][number], unknown>[] = [
    { header: "PR", cell: ({ row }) => `#${row.original.externalReference}` },
    {
      header: "Status",
      size: TYPE_COLUMN_SIZE,
      cell: ({ row }) => <Badge label={prStatusLabel(row.original.status)} />,
    },
    ...artifactColumns<GitActivityData["pull_requests"][number]>(artifactById),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Branches</h3>
        <DataTable columns={branchColumns} data={activity.branches} emptyMessage="Nenhuma branch ainda." />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commits</h3>
        <DataTable columns={commitColumns} data={activity.commits} emptyMessage="Nenhum commit ainda." />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pull Requests</h3>
        <DataTable columns={pullRequestColumns} data={activity.pull_requests} emptyMessage="Nenhum pull request ainda." />
      </div>
    </div>
  );
}
