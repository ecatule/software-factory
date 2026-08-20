import { RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import type { Artifact, GitActivity as GitActivityData } from "../../services/types";
import { useUnpushedCommits, usePushPendingCommits } from "../../services/useGitActivity";
import { GitActivity } from "../GitActivity";

interface Props {
  demandId: string;
  activity?: GitActivityData;
  artifacts?: Artifact[];
}

export function GitTab({ demandId, activity, artifacts }: Props) {
  const { hasPermission } = useAuth();
  const unpushed = useUnpushedCommits(demandId);
  const pushCommits = usePushPendingCommits(demandId);
  const artifactById = new Map((artifacts ?? []).map((a) => [a.id, a] as const));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Commits pendentes de push</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              O Developer Agent às vezes commita direto no clone local (sem passar pelo fluxo rastreado da
              plataforma) — clique em "Verificar" para conferir se algum artefato tem commits locais que
              ainda não foram enviados ao repositório remoto.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void unpushed.refetch()}
            disabled={unpushed.isFetching}
          >
            <RefreshCw className={unpushed.isFetching ? "animate-spin" : undefined} /> Verificar
          </Button>
        </div>

        {unpushed.isFetched && (unpushed.data?.length ?? 0) === 0 && (
          <p className="text-sm font-medium text-success">Nenhum commit pendente de push.</p>
        )}

        {!!unpushed.data?.length && (
          <ul className="flex flex-col gap-2">
            {unpushed.data.map((entry) => (
              <li
                key={entry.artifactId}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {artifactById.get(entry.artifactId)?.name ?? entry.artifactId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.commits.length} commit(s) pendente(s) — {entry.commits.map((c) => c.sha.slice(0, 7)).join(", ")}
                  </span>
                </div>
                {hasPermission("GIT_WRITE") && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pushCommits.isPending}
                    onClick={() => pushCommits.mutate([entry.artifactId])}
                  >
                    <Upload /> Enviar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {pushCommits.isError && (
          <p className="text-sm font-medium text-destructive">
            {pushCommits.error instanceof Error ? pushCommits.error.message : "Falha ao enviar os commits."}
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Git</h2>
        <GitActivity activity={activity} artifacts={artifacts} />
      </div>
    </div>
  );
}
