import type { DemandWorkspace } from "../services/types";

interface Props {
  workspace?: DemandWorkspace | null;
}

/** spec User Story 5: shows the demand's workspace structure. */
export function WorkspaceTree({ workspace }: Props) {
  if (!workspace) return <p>No workspace created yet.</p>;
  return (
    <div className="workspace-tree">
      <p>{workspace.path}</p>
      <p>Status: {workspace.status}</p>
    </div>
  );
}
