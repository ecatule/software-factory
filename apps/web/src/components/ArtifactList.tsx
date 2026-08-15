import type { Artifact } from "../services/types";

interface Props {
  artifacts?: Artifact[];
}

/** spec User Story 5: each artifact's status shown alongside the cockpit. */
export function ArtifactList({ artifacts }: Props) {
  if (!artifacts?.length) return <p className="text-sm text-muted-foreground">No artifacts identified yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-foreground">
      {artifacts.map((artifact) => (
        <li key={artifact.id}>
          <strong className="font-semibold">{artifact.name}</strong> ({artifact.type}
          {artifact.technology ? `, ${artifact.technology}` : ""}) — {artifact.status}
        </li>
      ))}
    </ul>
  );
}
