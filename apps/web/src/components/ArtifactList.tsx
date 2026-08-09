import type { Artifact } from "../services/types";

interface Props {
  artifacts?: Artifact[];
}

/** spec User Story 5: each artifact's status shown alongside the cockpit. */
export function ArtifactList({ artifacts }: Props) {
  if (!artifacts?.length) return <p>No artifacts identified yet.</p>;
  return (
    <ul className="artifact-list">
      {artifacts.map((artifact) => (
        <li key={artifact.id}>
          <strong>{artifact.name}</strong> ({artifact.type}
          {artifact.technology ? `, ${artifact.technology}` : ""}) — {artifact.status}
        </li>
      ))}
    </ul>
  );
}
