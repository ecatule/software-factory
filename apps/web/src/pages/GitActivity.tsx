import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@software-factory/ui";
import { useBranchesList, useCommitsList, usePullRequestsList } from "../services/useGitActivity";

/** spec User Story 13: cross-demand branches, commits, and Pull Requests. */
export function GitActivity() {
  const [page] = useState(1);
  const { data: branches } = useBranchesList(page);
  const { data: commits } = useCommitsList(page);
  const { data: pullRequests } = usePullRequestsList(page);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Git Activity</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Branches</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {branches?.items.map((b) => (
            <li key={b.id}>
              {b.name} — <Link className="text-primary hover:underline" to={`/demands/${b.demandId}`}>demand</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Commits</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {commits?.items.map((c) => (
            <li key={c.id}>
              {c.sha.slice(0, 8)} — <Link className="text-primary hover:underline" to={`/demands/${c.demandId}`}>demand</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pull Requests</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {pullRequests?.items.map((pr) => (
            <li key={pr.id} className="flex items-center gap-2">
              #{pr.externalReference} <Badge label={pr.status} /> —{" "}
              <Link className="text-primary hover:underline" to={`/demands/${pr.demandId}`}>demand</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
