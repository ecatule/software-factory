import type { TimelineEntry } from "../../services/types";
import { Timeline } from "../Timeline";

interface Props {
  entries?: TimelineEntry[];
}

export function TimelineTab({ entries }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Timeline</h2>
      <Timeline entries={entries} />
    </div>
  );
}
