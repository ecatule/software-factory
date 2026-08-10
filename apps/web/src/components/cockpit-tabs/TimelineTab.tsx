import type { TimelineEntry } from "../../services/types";
import { Timeline } from "../Timeline";

interface Props {
  entries?: TimelineEntry[];
}

export function TimelineTab({ entries }: Props) {
  return (
    <div className="cockpit-tab">
      <h2>Timeline</h2>
      <Timeline entries={entries} />
    </div>
  );
}
