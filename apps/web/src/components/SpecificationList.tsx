import { Link } from "react-router-dom";
import type { Specification } from "../services/types";

interface Props {
  specifications?: Specification[];
}

/** spec 001 User Story 5: which SDD documents exist for this demand so far. */
export function SpecificationList({ specifications }: Props) {
  if (!specifications?.length) return <p>No specification documents yet.</p>;
  return (
    <ul className="specification-list">
      {specifications.map((spec) => (
        <li key={spec.id}>
          {spec.documentType} — version {spec.currentVersionId ? "current" : "none"}{" "}
          {/* spec 002 User Story 8: open the full Markdown editor for this document. */}
          <Link to={`/specifications/${spec.id}`}>Open in editor</Link>
        </li>
      ))}
    </ul>
  );
}
