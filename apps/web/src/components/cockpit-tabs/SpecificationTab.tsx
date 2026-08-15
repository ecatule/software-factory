import type { Specification } from "../../services/types";
import { SpecificationList } from "../SpecificationList";

interface Props {
  demandId: string;
  specifications?: Specification[];
}

export function SpecificationTab({ demandId, specifications }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Specifications</h2>
      <SpecificationList demandId={demandId} specifications={specifications} />
    </div>
  );
}
