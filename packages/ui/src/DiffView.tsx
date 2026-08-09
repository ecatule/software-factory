export interface DiffViewProps {
  additions: string[];
  deletions: string[];
}

/** Renders the {additions,deletions} shape 001's diff endpoint already computes. */
export function DiffView({ additions, deletions }: DiffViewProps) {
  return (
    <div className="diff-view">
      <div className="diff-view-deletions">
        {deletions.map((line, i) => (
          <div key={`del-${i}`} className="diff-line diff-line-removed">
            - {line}
          </div>
        ))}
      </div>
      <div className="diff-view-additions">
        {additions.map((line, i) => (
          <div key={`add-${i}`} className="diff-line diff-line-added">
            + {line}
          </div>
        ))}
      </div>
    </div>
  );
}
