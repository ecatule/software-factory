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
    <div className="git-activity-page">
      <h1>Git Activity</h1>

      <section>
        <h2>Branches</h2>
        <ul>
          {branches?.items.map((b) => (
            <li key={b.id}>
              {b.name} — <Link to={`/demands/${b.demandId}`}>demand</Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Commits</h2>
        <ul>
          {commits?.items.map((c) => (
            <li key={c.id}>
              {c.sha.slice(0, 8)} — <Link to={`/demands/${c.demandId}`}>demand</Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Pull Requests</h2>
        <ul>
          {pullRequests?.items.map((pr) => (
            <li key={pr.id}>
              #{pr.externalReference} <Badge label={pr.status} /> —{" "}
              <Link to={`/demands/${pr.demandId}`}>demand</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
