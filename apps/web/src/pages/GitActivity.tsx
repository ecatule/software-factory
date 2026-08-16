import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, DataTable, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  prStatusLabel,
  useBranchesList,
  useCommitsList,
  usePullRequestsList,
  type ArtifactRef,
  type BranchItem,
  type CommitItem,
  type PullRequestItem,
} from "../services/useGitActivity";

// Explicit `size` (px) on the shared columns below — lets `DataTable` line
// these columns up across the three separate Branches/Commits/Pull Requests
// tables (each is its own <table>, so this only works because every grid
// declares the exact same widths for the columns they have in common).
const ARTIFACT_COLUMN_SIZE = 260;
const TYPE_COLUMN_SIZE = 140;
const ACTIONS_COLUMN_SIZE = 90;

function artifactColumns<T extends { artifact: ArtifactRef | null }>(): ColumnDef<T, unknown>[] {
  return [
    {
      header: "Artefato",
      size: ARTIFACT_COLUMN_SIZE,
      cell: ({ row }) => row.original.artifact?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Tipo",
      size: TYPE_COLUMN_SIZE,
      cell: ({ row }) => (row.original.artifact ? <Badge label={row.original.artifact.type} /> : null),
    },
  ];
}

function actionsColumn<T extends { demandId: string }>(): ColumnDef<T, unknown> {
  return {
    id: "actions",
    header: "Ações",
    size: ACTIONS_COLUMN_SIZE,
    cell: ({ row }) => (
      <Button type="button" variant="ghost" size="icon" asChild>
        <Link to={`/demands/${row.original.demandId}`} aria-label="Ver demanda">
          <ArrowUpRight />
        </Link>
      </Button>
    ),
  };
}

/** spec User Story 13: cross-demand branches, commits, and Pull Requests. */
export function GitActivity() {
  const [branchesPage, setBranchesPage] = useState(1);
  const [commitsPage, setCommitsPage] = useState(1);
  const [pullRequestsPage, setPullRequestsPage] = useState(1);
  const { data: branches, isLoading: branchesLoading } = useBranchesList(branchesPage);
  const { data: commits, isLoading: commitsLoading } = useCommitsList(commitsPage);
  const { data: pullRequests, isLoading: pullRequestsLoading } = usePullRequestsList(pullRequestsPage);

  const branchColumns: ColumnDef<BranchItem, unknown>[] = [
    { header: "Branch", accessorKey: "name" },
    ...artifactColumns<BranchItem>(),
    actionsColumn<BranchItem>(),
  ];

  const commitColumns: ColumnDef<CommitItem, unknown>[] = [
    { header: "SHA", cell: ({ row }) => row.original.sha.slice(0, 8) },
    ...artifactColumns<CommitItem>(),
    actionsColumn<CommitItem>(),
  ];

  const pullRequestColumns: ColumnDef<PullRequestItem, unknown>[] = [
    { header: "PR", cell: ({ row }) => `#${row.original.externalReference}` },
    {
      header: "Status",
      size: TYPE_COLUMN_SIZE,
      cell: ({ row }) => <Badge label={prStatusLabel(row.original.status)} />,
    },
    ...artifactColumns<PullRequestItem>(),
    actionsColumn<PullRequestItem>(),
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Atividade do Git</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Branches</h2>
        <DataTable
          columns={branchColumns}
          data={branches?.items ?? []}
          isLoading={branchesLoading}
          emptyMessage="Nenhuma branch ainda."
        />
        {branches && (
          <Pagination
            page={branches.page}
            pageSize={branches.page_size}
            total={branches.total}
            onPageChange={setBranchesPage}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Commits</h2>
        <DataTable
          columns={commitColumns}
          data={commits?.items ?? []}
          isLoading={commitsLoading}
          emptyMessage="Nenhum commit ainda."
        />
        {commits && (
          <Pagination
            page={commits.page}
            pageSize={commits.page_size}
            total={commits.total}
            onPageChange={setCommitsPage}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pull Requests</h2>
        <DataTable
          columns={pullRequestColumns}
          data={pullRequests?.items ?? []}
          isLoading={pullRequestsLoading}
          emptyMessage="Nenhum pull request ainda."
        />
        {pullRequests && (
          <Pagination
            page={pullRequests.page}
            pageSize={pullRequests.page_size}
            total={pullRequests.total}
            onPageChange={setPullRequestsPage}
          />
        )}
      </section>
    </div>
  );
}
