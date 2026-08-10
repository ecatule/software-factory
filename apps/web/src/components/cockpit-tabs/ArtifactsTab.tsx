import type { Artifact } from "../../services/types";
import { ArtifactList } from "../ArtifactList";

interface Props {
  artifacts?: Artifact[];
}

export function ArtifactsTab({ artifacts }: Props) {
  return (
    <div className="cockpit-tab">
      <h2>Artifacts</h2>
      <ArtifactList artifacts={artifacts} />
    </div>
  );
}
