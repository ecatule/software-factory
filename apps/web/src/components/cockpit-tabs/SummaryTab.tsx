import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal, MarkdownEditor, DataTable } from "@software-factory/ui";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiPost } from "../../services/api";
import { useCreateIncrement, useIncrementsList, type Increment } from "../../services/useIncrements";
import { useSpecificationVersionsList } from "../../services/useSpecificationVersions";
import type { Demand, Specification, WorkflowView } from "../../services/types";
import { WorkflowProgress } from "../WorkflowProgress";

interface Props {
  demandId: string;
  demand?: Demand;
  workflow?: WorkflowView;
}

/** feature 004 US5: everything that was at the top of the flat Cockpit page — header, workflow, increments. */
export function SummaryTab({ demandId, demand, workflow }: Props) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { data: increments } = useIncrementsList(demandId);
  const createIncrement = useCreateIncrement(demandId);
  const [isCreatingIncrement, setIsCreatingIncrement] = useState(false);
  const [reason, setReason] = useState("");
  const [viewingIncrement, setViewingIncrement] = useState<Increment | null>(null);

  const currentIncrement = increments?.[increments.length - 1];
  const canCreateIncrement = !currentIncrement || currentIncrement.status === "COMPLETED";

  async function submitIncrement() {
    await createIncrement.mutateAsync({ reason });
    setIsCreatingIncrement(false);
    setReason("");
  }

  // follow-up: a COMPLETED incremento is finished history — opens the
  // read-only snapshot. A still-open one is being worked on — jumps straight
  // into the Especificação Assistida wizard (Parte 1, its default step on a
  // fresh mount) so the analyst can keep filling it in, instead of a
  // read-only view of nothing yet.
  async function openIncrement(inc: Increment) {
    if (inc.status === "COMPLETED") {
      setViewingIncrement(inc);
      return;
    }
    const spec = await apiPost<Specification>(`/demands/${demandId}/specifications/SPEC/ensure`);
    navigate(`/specifications/${spec.id}`);
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
        <DataTable
          columns={incrementColumns(openIncrement)}
          data={increments ?? []}
          emptyMessage="Nenhum incremento ainda."
        />
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

      {viewingIncrement && (
        <IncrementSnapshotModal
          demandId={demandId}
          increment={viewingIncrement}
          onClose={() => setViewingIncrement(null)}
        />
      )}
    </div>
  );
}

/** follow-up: the increments list was plain text with a trailing icon button — now a grid, same `.icon-button`/`.icon-actions` convention as the other grids in this app. */
function incrementColumns(onOpen: (increment: Increment) => void): ColumnDef<Increment, unknown>[] {
  return [
    { header: "Nº", accessorKey: "number" },
    { header: "Status", accessorKey: "status" },
    { header: "Motivo", accessorKey: "reason" },
    {
      header: "Ações",
      cell: ({ row }) => {
        const inc = row.original;
        const completed = inc.status === "COMPLETED";
        return (
          <span className="icon-actions">
            <button
              type="button"
              className="icon-button"
              title={completed ? "Ver detalhes" : "Abrir no wizard"}
              aria-label={completed ? "Ver detalhes" : "Abrir no wizard"}
              onClick={() => onOpen(inc)}
            >
              {completed ? "👁" : "✎"}
            </button>
          </span>
        );
      },
    },
  ];
}

/**
 * follow-up: "Ver detalhes" de um incremento — mostra cada documento
 * (SPEC/PLAN/TASKS/ANALYSIS/CHECKLIST) exatamente como estava naquele
 * incremento (última `SpecificationVersion` com `incrementId` igual ao
 * incremento visualizado), somente leitura. Complementa `ReviewStep`
 * (SpecificationWorkspace.tsx), que só mostra o incremento ATUAL — este
 * modal serve tanto para conferir um incremento COMPLETED quanto para
 * revisar o progresso de um OPEN.
 */
function IncrementSnapshotModal({
  demandId,
  increment,
  onClose,
}: {
  demandId: string;
  increment: Increment;
  onClose: () => void;
}) {
  const { data: specifications } = useQuery({
    queryKey: ["demand", demandId, "specifications"],
    queryFn: () => apiGet<Specification[]>(`/demands/${demandId}/specifications`),
  });

  return (
    <Modal
      title={`Incremento ${increment.number} — ${increment.status} — ${increment.reason}`}
      isOpen
      onClose={onClose}
      className="modal-wide"
    >
      {!specifications?.length && <p>Nenhum documento gerado ainda para esta demanda.</p>}
      {specifications?.map((spec) => (
        <IncrementDocumentSnapshot key={spec.id} specification={spec} incrementId={increment.id} />
      ))}
    </Modal>
  );
}

function IncrementDocumentSnapshot({
  specification,
  incrementId,
}: {
  specification: Specification;
  incrementId: string;
}) {
  const { data: versions } = useSpecificationVersionsList(specification.id);
  const versionForIncrement = versions?.filter((v) => v.incrementId === incrementId).at(-1);

  return (
    <section>
      <h3>{specification.documentType}</h3>
      {versionForIncrement ? (
        <MarkdownEditor value={versionForIncrement.content} onChange={() => {}} readOnly />
      ) : (
        <p>Não gerado neste incremento.</p>
      )}
    </section>
  );
}
