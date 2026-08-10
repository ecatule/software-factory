import type { Specification } from "../../services/types";
import { SpecificationList } from "../SpecificationList";

interface Props {
  demandId: string;
  specifications?: Specification[];
}

export function SpecificationTab({ demandId, specifications }: Props) {
  return (
    <div className="cockpit-tab">
      <h2>Specifications</h2>
      <SpecificationList demandId={demandId} specifications={specifications} />
    </div>
  );
}
