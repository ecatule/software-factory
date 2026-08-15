import { useAuth } from "../../context/AuthContext";
import { useAuditList } from "../../services/useAudit";

interface Props {
  demandId: string;
}

/** feature 004 US5/FR-006: only visible/loaded for users holding AUDIT_READ (defense-in-depth, mirrors the /audit page gate). */
export function AuditTab({ demandId }: Props) {
  const { hasPermission } = useAuth();
  const canRead = hasPermission("AUDIT_READ");
  const { data } = useAuditList({ entityType: "demands", enabled: canRead });

  if (!canRead) return <p className="text-sm text-muted-foreground">You do not have permission to view the audit trail.</p>;

  const entries = data?.items.filter((entry) => entry.entityId === demandId) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Audit</h2>
      {!entries.length && <p className="text-sm text-muted-foreground">No audit entries for this demand yet.</p>}
      {!!entries.length && (
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {entries.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.occurredAt} className="text-muted-foreground">
                {new Date(entry.occurredAt).toLocaleString()}
              </time>{" "}
              — {entry.action}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
