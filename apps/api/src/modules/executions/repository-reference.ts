/**
 * follow-up: `Repository.externalReference` stores only the git host +
 * org/user BASE (e.g. "https://github.com/ecatule") — never a specific
 * repo — so a single Repository row is shared by every Artifact in that
 * org instead of re-typing the base for each real repository. The actual
 * repo identity comes from the Artifact's name (e.g. "vexur-dominio"),
 * composed here into the "owner/repo" form `CodeRepositoryProvider`
 * expects (e.g. "ecatule/vexur-dominio") — this is the ONLY place that
 * composition happens; every caller works with the composed string after
 * this, unaware of the split.
 */
export function composeOwnerRepo(repositoryBase: string, artifactName: string): string {
  const owner = repositoryBase
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/+$/, "");
  return `${owner}/${artifactName.trim()}`;
}
