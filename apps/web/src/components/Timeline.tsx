import type { TimelineEntry } from "../services/types";

interface Props {
  entries?: TimelineEntry[];
}

/** spec User Story 5, Acceptance Scenario 3: chronological event timeline. */
export function Timeline({ entries }: Props) {
  if (!entries?.length) return <p>No events recorded yet.</p>;
  return (
    <ol className="timeline">
      {entries.map((entry) => (
        <li key={entry.id}>
          <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time>{" "}
          — {entry.action} {entry.entityType}
          {entry.entityId ? ` (${entry.entityId})` : ""}
        </li>
      ))}
    </ol>
  );
}
