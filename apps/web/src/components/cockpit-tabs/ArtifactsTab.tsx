import type { Artifact } from "../../services/types";
import { ArtifactList } from "../ArtifactList";

interface Props {
  artifacts?: Artifact[];
}

export function ArtifactsTab({ artifacts }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Artefatos</h2>
      <ArtifactList artifacts={artifacts} />
    </div>
  );
}
