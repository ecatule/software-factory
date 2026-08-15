export interface DiffViewProps {
  additions: string[];
  deletions: string[];
}

/** Renders the {additions,deletions} shape 001's diff endpoint already computes. */
export function DiffView({ additions, deletions }: DiffViewProps) {
  return (
    <div className="grid grid-cols-2 gap-4 font-mono text-sm">
      <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
        {deletions.map((line, i) => (
          <div key={`del-${i}`} className="rounded bg-destructive/10 px-2 py-0.5 text-destructive">
            - {line}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
        {additions.map((line, i) => (
          <div key={`add-${i}`} className="rounded bg-success/10 px-2 py-0.5 text-success">
            + {line}
          </div>
        ))}
      </div>
    </div>
  );
}
