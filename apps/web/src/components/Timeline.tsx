import type { TimelineEntry } from "../services/types";

interface Props {
  entries?: TimelineEntry[];
}

/** spec User Story 5, Acceptance Scenario 3: chronological event timeline. */
export function Timeline({ entries }: Props) {
  if (!entries?.length) return <p className="text-sm text-muted-foreground">No events recorded yet.</p>;
  return (
    <ol className="flex flex-col gap-2 border-l-2 border-border pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="text-sm text-foreground">
          <time dateTime={entry.occurredAt} className="text-muted-foreground">
            {new Date(entry.occurredAt).toLocaleString()}
          </time>{" "}
          — {entry.action} {entry.entityType}
          {entry.entityId ? ` (${entry.entityId})` : ""}
        </li>
      ))}
    </ol>
  );
}
