import type { GitActivity as GitActivityData } from "../../services/types";
import { GitActivity } from "../GitActivity";

interface Props {
  activity?: GitActivityData;
}

export function GitTab({ activity }: Props) {
  return (
    <div className="cockpit-tab">
      <h2>Git</h2>
      <GitActivity activity={activity} />
    </div>
  );
}
