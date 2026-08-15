import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiPost } from "../services/api";
import type { Specification } from "../services/types";

interface Props {
  demandId: string;
  specifications?: Specification[];
}

const DOCUMENT_TYPES = ["SPEC", "PLAN"] as const;

/**
 * spec 001 User Story 5: which SDD documents exist for this demand so far.
 * feature 003 (live-validation finding): a brand-new demand has none yet —
 * offer to start one (lazily creates the Specification container, spec
 * User Story 1 Acceptance Scenario 1) instead of a dead end.
 */
export function SpecificationList({ demandId, specifications }: Props) {
  const navigate = useNavigate();
  const existingTypes = new Set((specifications ?? []).map((s) => s.documentType));

  async function start(documentType: string) {
    const spec = await apiPost<Specification>(
      `/demands/${demandId}/specifications/${documentType}/ensure`,
    );
    navigate(`/specifications/${spec.id}`);
  }

  return (
    <ul className="flex flex-col gap-2">
      {specifications?.map((spec) => (
        <li key={spec.id} className="flex items-center gap-2 text-sm text-foreground">
          {spec.documentType} — version {spec.currentVersionId ? "current" : "none"}{" "}
          {/* spec 002 User Story 8 / 003 User Story 1: open the Especificação Assistida workspace. */}
          <Link to={`/specifications/${spec.id}`} className="text-primary hover:underline">
            Open in editor
          </Link>
        </li>
      ))}
      {DOCUMENT_TYPES.filter((t) => !existingTypes.has(t)).map((documentType) => (
        <li key={documentType} className="flex items-center gap-2 text-sm text-foreground">
          {documentType} — not started{" "}
          <Button type="button" variant="outline" size="sm" onClick={() => start(documentType)}>
            Start
          </Button>
        </li>
      ))}
    </ul>
  );
}
