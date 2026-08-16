import { workspaceStatusLabel } from "../services/useWorkspaces";
import type { DemandWorkspace } from "../services/types";

interface Props {
  workspace?: DemandWorkspace | null;
}

/** spec User Story 5: shows the demand's workspace structure. */
export function WorkspaceTree({ workspace }: Props) {
  if (!workspace) return <p className="text-sm text-muted-foreground">Nenhum workspace criado ainda.</p>;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-sm text-foreground">
      <p className="font-mono">{workspace.path}</p>
      <p className="text-muted-foreground">Status: {workspaceStatusLabel(workspace.status)}</p>
    </div>
  );
}
