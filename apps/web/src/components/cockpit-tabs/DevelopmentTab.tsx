import type { DemandWorkspace } from "../../services/types";
import { WorkspaceTree } from "../WorkspaceTree";

interface Props {
  workspace?: DemandWorkspace | null;
}

/** feature 004 US5: the demand's workspace — where the Developer Agent checks out and works. */
export function DevelopmentTab({ workspace }: Props) {
  return (
    <div className="cockpit-tab">
      <h2>Development</h2>
      <WorkspaceTree workspace={workspace} />
    </div>
  );
}
