import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, DataTable, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "../context/AuthContext";
import { useDemandsList } from "../services/useDemands";
import {
  PR_STATUS_LABELS,
  prStatusLabel,
  useBranchesList,
  useCommitsList,
  usePullRequestsList,
  useSyncPullRequest,
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

/** adds "Sincronizar" (re-fetch status/URL from GitHub) alongside "Ver demanda" — PR-only, the other tables have no live remote state to refresh. */
function pullRequestActionsColumn(
  canSync: boolean,
  onSync: (pullRequestId: string) => void,
  syncingId: string | null,
): ColumnDef<PullRequestItem, unknown> {
  return {
    id: "actions",
    header: "Ações",
    size: canSync ? ACTIONS_COLUMN_SIZE + 40 : ACTIONS_COLUMN_SIZE,
    cell: ({ row }) => (
      <span className="flex items-center gap-1">
        {canSync && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Sincronizar com o GitHub"
            aria-label="Sincronizar com o GitHub"
            disabled={syncingId === row.original.id}
            onClick={() => onSync(row.original.id)}
          >
            <RotateCcw className={syncingId === row.original.id ? "animate-spin" : undefined} />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link to={`/demands/${row.original.demandId}`} aria-label="Ver demanda">
            <ArrowUpRight />
          </Link>
        </Button>
      </span>
    ),
  };
}

const TABS = [
  { key: "branches", label: "Branches" },
  { key: "commits", label: "Commits" },
  { key: "pull-requests", label: "Pull Requests" },
] as const;

/**
 * spec User Story 13: cross-demand branches, commits, and Pull Requests.
 * follow-up: was three stacked sections on one page — with real data volume
 * that's a lot of scrolling to reach Pull Requests. Now tabs, one table
 * visible at a time, same pill style as DemandCockpit's tab nav.
 */
export function GitActivity() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("branches");
  const syncPullRequest = useSyncPullRequest();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [demandId, setDemandId] = useState("");
  const [prStatus, setPrStatus] = useState("");
  const [branchesPage, setBranchesPage] = useState(1);
  const [commitsPage, setCommitsPage] = useState(1);
  const [pullRequestsPage, setPullRequestsPage] = useState(1);
  const { data: demands } = useDemandsList({ pageSize: 100 });
  const { data: branches, isLoading: branchesLoading } = useBranchesList(branchesPage, { demandId });
  const { data: commits, isLoading: commitsLoading } = useCommitsList(commitsPage, { demandId });
  const { data: pullRequests, isLoading: pullRequestsLoading } = usePullRequestsList(pullRequestsPage, {
    demandId,
    status: prStatus,
  });

  function updateDemandFilter(value: string) {
    setDemandId(value);
    setBranchesPage(1);
    setCommitsPage(1);
    setPullRequestsPage(1);
  }

  function updatePrStatusFilter(value: string) {
    setPrStatus(value);
    setPullRequestsPage(1);
  }

  async function syncPr(pullRequestId: string) {
    setSyncingId(pullRequestId);
    try {
      await syncPullRequest.mutateAsync(pullRequestId);
    } finally {
      setSyncingId(null);
    }
  }

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
    {
      header: "PR",
      cell: ({ row }) =>
        row.original.url ? (
          <a
            href={row.original.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            #{row.original.externalReference} <ExternalLink className="size-3.5" />
          </a>
        ) : (
          `#${row.original.externalReference}`
        ),
    },
    {
      header: "Status",
      size: TYPE_COLUMN_SIZE,
      cell: ({ row }) => <Badge label={prStatusLabel(row.original.status)} />,
    },
    ...artifactColumns<PullRequestItem>(),
    pullRequestActionsColumn(hasPermission("PR_CREATE"), syncPr, syncingId),
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Atividade do Git</h1>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeTab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="git-activity-demand" className="text-sm font-medium text-foreground">
            Demanda
          </label>
          <NativeSelect
            id="git-activity-demand"
            className="w-64"
            value={demandId}
            onChange={(e) => updateDemandFilter(e.target.value)}
          >
            <option value="">Todas as demandas</option>
            {demands?.items.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </NativeSelect>
        </div>
        {activeTab === "pull-requests" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="git-activity-pr-status" className="text-sm font-medium text-foreground">
              Status
            </label>
            <NativeSelect
              id="git-activity-pr-status"
              className="w-auto"
              value={prStatus}
              onChange={(e) => updatePrStatusFilter(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.keys(PR_STATUS_LABELS).map((status) => (
                <option key={status} value={status}>
                  {prStatusLabel(status)}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      {activeTab === "branches" && (
        <section className="flex flex-col gap-3">
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
      )}

      {activeTab === "commits" && (
        <section className="flex flex-col gap-3">
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
      )}

      {activeTab === "pull-requests" && (
        <section className="flex flex-col gap-3">
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
      )}
    </div>
  );
}
