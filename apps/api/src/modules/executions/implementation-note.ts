const UNASSISTED_NOTE_HEADING =
  "### Nota de implementação (execução não assistida, sem analista disponível)";

/**
 * follow-up: `/speckit-implement` sometimes has to make an assumption on its
 * own (no analyst available to ask) and documents it back into `spec.md`
 * under this fixed heading — an emergent convention from the unattended
 * prompt instructions, not something this codebase's skill templates
 * mandate verbatim (confirmed: no match for this string anywhere under
 * `.claude`/`.specify`). Extracts the heading plus everything up to the next
 * `##`/`###` heading (or end of file) as a short excerpt for the UI — null
 * when no such section exists, i.e. the run needed no unassisted decision.
 */
export function extractUnassistedNote(content: string | undefined): string | null {
  if (!content) return null;
  const startIndex = content.indexOf(UNASSISTED_NOTE_HEADING);
  if (startIndex === -1) return null;

  const rest = content.slice(startIndex);
  const nextHeadingMatch = /\n#{1,3}\s/.exec(rest.slice(UNASSISTED_NOTE_HEADING.length));
  const endIndex = nextHeadingMatch
    ? UNASSISTED_NOTE_HEADING.length + nextHeadingMatch.index
    : rest.length;

  return rest.slice(0, endIndex).trim();
}
