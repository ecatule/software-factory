import { useState } from "react";
import { useParams } from "react-router-dom";
import { MarkdownEditor, DiffView } from "@software-factory/ui";
import {
  useCreateSpecificationVersion,
  useRestoreSpecificationVersion,
  useSpecificationDiff,
  useSpecificationVersionsList,
} from "../services/useSpecificationVersions";

/** spec User Story 8: edit, version, diff, and restore a Specification document. */
export function SpecificationEditor() {
  const { specificationId } = useParams<{ specificationId: string }>();
  const { data: versions } = useSpecificationVersionsList(specificationId ?? "");
  const createVersion = useCreateSpecificationVersion(specificationId ?? "");
  const restoreVersion = useRestoreSpecificationVersion(specificationId ?? "");

  const latest = versions?.[versions.length - 1];
  const [draft, setDraft] = useState<string | null>(null);
  const [diffPair, setDiffPair] = useState<[number, number] | null>(null);
  const { data: diff } = useSpecificationDiff(
    specificationId ?? "",
    diffPair?.[0] ?? null,
    diffPair?.[1] ?? null,
  );

  if (!specificationId) return <p>No specification selected.</p>;
  if (!versions) return <p>Loading…</p>;

  const content = draft ?? latest?.content ?? "";

  async function save() {
    if (draft === null) return;
    await createVersion.mutateAsync({ content: draft, reason: "Edited via console" });
    setDraft(null);
  }

  return (
    <div className="specification-editor-page">
      <h1>Specification</h1>

      <MarkdownEditor value={content} onChange={setDraft} />
      <button type="button" onClick={save} disabled={draft === null}>
        Save new version
      </button>

      <section>
        <h2>Version history</h2>
        <ul>
          {versions.map((v) => (
            <li key={v.id}>
              v{v.versionNumber} — {v.reason ?? "no reason recorded"}
              <button type="button" onClick={() => restoreVersion.mutate(v.versionNumber)}>
                Restore
              </button>
              {versions.length > 1 && v.versionNumber > 1 && (
                <button
                  type="button"
                  onClick={() => setDiffPair([v.versionNumber - 1, v.versionNumber])}
                >
                  Diff vs previous
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {diff && (
        <section>
          <h2>Diff</h2>
          <DiffView additions={diff.additions} deletions={diff.deletions} />
        </section>
      )}
    </div>
  );
}
