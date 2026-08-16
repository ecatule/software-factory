import type { Artifact, GitActivity as GitActivityData } from "../../services/types";
import { GitActivity } from "../GitActivity";

interface Props {
  activity?: GitActivityData;
  artifacts?: Artifact[];
}

export function GitTab({ activity, artifacts }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Git</h2>
      <GitActivity activity={activity} artifacts={artifacts} />
    </div>
  );
}
