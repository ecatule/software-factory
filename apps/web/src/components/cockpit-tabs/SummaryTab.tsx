import { useState } from "react";
import { Modal } from "@software-factory/ui";
import { useAuth } from "../../context/AuthContext";
import { useCreateIncrement, useIncrementsList } from "../../services/useIncrements";
import type { Demand, WorkflowView } from "../../services/types";
import { WorkflowProgress } from "../WorkflowProgress";

interface Props {
  demandId: string;
  demand?: Demand;
  workflow?: WorkflowView;
}

/** feature 004 US5: everything that was at the top of the flat Cockpit page — header, workflow, increments. */
export function SummaryTab({ demandId, demand, workflow }: Props) {
  const { hasPermission } = useAuth();
  const { data: increments } = useIncrementsList(demandId);
  const createIncrement = useCreateIncrement(demandId);
  const [isCreatingIncrement, setIsCreatingIncrement] = useState(false);
  const [reason, setReason] = useState("");

  const currentIncrement = increments?.[increments.length - 1];
  const canCreateIncrement = !currentIncrement || currentIncrement.status === "COMPLETED";

  async function submitIncrement() {
    await createIncrement.mutateAsync({ reason });
    setIsCreatingIncrement(false);
    setReason("");
  }

  return (
    <div className="cockpit-tab summary-tab">
      <section>
        <h2>{demand?.title} <small>({demand?.status})</small></h2>
        {currentIncrement && <small>Incremento {currentIncrement.number}</small>}
      </section>

      <section>
        <h2>Workflow</h2>
        <WorkflowProgress workflow={workflow} />
      </section>

      <section>
        <h2>Incrementos</h2>
        {hasPermission("DEMAND_WRITE") && (
          <button
            type="button"
            onClick={() => setIsCreatingIncrement(true)}
            disabled={!canCreateIncrement}
            title={canCreateIncrement ? undefined : "O incremento atual precisa estar concluído"}
          >
            Criar incremento
          </button>
        )}
        <ul>
          {increments?.map((inc) => (
            <li key={inc.id}>
              Incremento {inc.number} — {inc.status} — {inc.reason}
            </li>
          ))}
        </ul>
        <Modal
          title="Criar novo incremento"
          isOpen={isCreatingIncrement}
          onClose={() => setIsCreatingIncrement(false)}
        >
          <textarea
            placeholder="Motivo/alteração identificada"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="button" onClick={submitIncrement} disabled={!reason.trim()}>
            Criar
          </button>
        </Modal>
      </section>
    </div>
  );
}
