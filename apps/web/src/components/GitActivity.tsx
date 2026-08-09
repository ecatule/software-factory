interface Branch {
  id: string;
  name: string;
}
interface Commit {
  id: string;
  sha: string;
}
interface PullRequest {
  id: string;
  externalReference: string;
  status: string;
}
interface GitActivityData {
  branches: Branch[];
  commits: Commit[];
  pull_requests: PullRequest[];
}

interface Props {
  activity?: GitActivityData;
}

/** spec User Story 9: branch, commits, PR status visible per demand. */
export function GitActivity({ activity }: Props) {
  if (!activity) return <p>No Git activity yet.</p>;
  return (
    <div className="git-activity">
      <p>Branches: {activity.branches.map((b) => b.name).join(", ") || "none"}</p>
      <p>Commits: {activity.commits.length}</p>
      <ul>
        {activity.pull_requests.map((pr) => (
          <li key={pr.id}>
            PR #{pr.externalReference} — {pr.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
