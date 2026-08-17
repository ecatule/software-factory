import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal, MarkdownEditor, DataTable } from "@software-factory/ui";
import { Download, Eye, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiPost } from "../../services/api";
import { incrementStatusLabel, useCreateIncrement, useIncrementsList, type Increment } from "../../services/useIncrements";
import { useSpecificationVersionsList } from "../../services/useSpecificationVersions";
import { DEMAND_PRIORITIES, demandStatusLabel, demandTypeLabel, useUpdateDemand } from "../../services/useDemands";
import type { Demand, Specification, WorkflowView } from "../../services/types";
import { WorkflowProgress } from "../WorkflowProgress";

const DEMAND_TYPES = ["BUG", "FEATURE", "IMPROVEMENT", "TASK", "TECHNICAL_DEBT"];

interface Props {
  demandId: string;
  demand?: Demand;
  workflow?: WorkflowView;
}

const textareaClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** feature 004 US5: everything that was at the top of the flat Cockpit page — header, workflow, increments. */
export function SummaryTab({ demandId, demand, workflow }: Props) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { data: increments } = useIncrementsList(demandId);
  const createIncrement = useCreateIncrement(demandId);
  const [isCreatingIncrement, setIsCreatingIncrement] = useState(false);
  const [reason, setReason] = useState("");
  const [viewingIncrement, setViewingIncrement] = useState<Increment | null>(null);

  const updateDemand = useUpdateDemand(demandId);
  const [isEditingDemand, setIsEditingDemand] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [editPriority, setEditPriority] = useState("");

  function openEditDemand() {
    if (!demand) return;
    setEditTitle(demand.title);
    setEditDescription(demand.description);
    setEditType(demand.type);
    setEditPriority(demand.priority);
    setIsEditingDemand(true);
  }

  async function submitEditDemand() {
    await updateDemand.mutateAsync({
      title: editTitle,
      description: editDescription,
      type: editType,
      priority: editPriority,
    });
    setIsEditingDemand(false);
  }

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
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            {demand?.title}{" "}
            <span className="text-base font-normal text-muted-foreground">
              {demand && `(${demandStatusLabel(demand.status)})`}
            </span>
          </h2>
          {hasPermission("DEMAND_WRITE") && demand && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Editar demanda"
              aria-label="Editar demanda"
              onClick={openEditDemand}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
        {currentIncrement && (
          <p className="mt-1 text-sm text-muted-foreground">Incremento {currentIncrement.number}</p>
        )}
      </section>

      <Modal title="Editar demanda" isOpen={isEditingDemand} onClose={() => setIsEditingDemand(false)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editTitle" className="text-sm font-medium text-foreground">
              Título
            </label>
            <input
              id="editTitle"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editDescription" className="text-sm font-medium text-foreground">
              Descrição
            </label>
            <textarea
              id="editDescription"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={6}
              className={textareaClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editType" className="text-sm font-medium text-foreground">
              Tipo
            </label>
            <NativeSelect id="editType" value={editType} onChange={(e) => setEditType(e.target.value)}>
              {DEMAND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {demandTypeLabel(t)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editPriority" className="text-sm font-medium text-foreground">
              Prioridade
            </label>
            <NativeSelect id="editPriority" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
              {DEMAND_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            onClick={submitEditDemand}
            disabled={updateDemand.isPending || !editTitle.trim()}
            className="self-start"
          >
            Salvar
          </Button>
        </div>
      </Modal>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Workflow</h2>
        <WorkflowProgress workflow={workflow} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Incrementos</h2>
          {hasPermission("DEMAND_WRITE") && (
            <Button
              type="button"
              onClick={() => setIsCreatingIncrement(true)}
              disabled={!canCreateIncrement}
              title={canCreateIncrement ? undefined : "O incremento atual precisa estar concluído"}
            >
              <Plus /> Criar incremento
            </Button>
          )}
        </div>
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
          <div className="flex flex-col gap-4">
            <textarea
              placeholder="Motivo/alteração identificada"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className={textareaClass}
            />
            <Button type="button" onClick={submitIncrement} disabled={!reason.trim()} className="self-start">
              Criar
            </Button>
          </div>
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

/** follow-up: the increments list was plain text with a trailing icon button — now a grid with an icon-button action. */
function incrementColumns(onOpen: (increment: Increment) => void): ColumnDef<Increment, unknown>[] {
  return [
    { header: "Nº", accessorKey: "number" },
    { header: "Status", cell: ({ row }) => incrementStatusLabel(row.original.status) },
    { header: "Motivo", accessorKey: "reason" },
    {
      header: "Ações",
      cell: ({ row }) => {
        const inc = row.original;
        const completed = inc.status === "COMPLETED";
        return (
          <span className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title={completed ? "Ver detalhes" : "Abrir no wizard"}
              aria-label={completed ? "Ver detalhes" : "Abrir no wizard"}
              onClick={() => onOpen(inc)}
            >
              {completed ? <Eye className="size-4" /> : <Pencil className="size-4" />}
            </Button>
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
      title={`Incremento ${increment.number} — ${incrementStatusLabel(increment.status)} — ${increment.reason}`}
      isOpen
      onClose={onClose}
      className="modal-wide"
    >
      <div className="flex flex-col gap-4">
        {!specifications?.length && (
          <p className="text-sm text-muted-foreground">Nenhum documento gerado ainda para esta demanda.</p>
        )}
        {specifications?.map((spec) => (
          <IncrementDocumentSnapshot
            key={spec.id}
            specification={spec}
            increment={increment}
          />
        ))}
      </div>
    </Modal>
  );
}

function IncrementDocumentSnapshot({
  specification,
  increment,
}: {
  specification: Specification;
  increment: Increment;
}) {
  const { data: versions } = useSpecificationVersionsList(specification.id);
  const versionForIncrement = versions?.filter((v) => v.incrementId === increment.id).at(-1);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{specification.documentType}</h3>
        {versionForIncrement && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title="Baixar arquivo"
            aria-label="Baixar arquivo"
            onClick={() =>
              downloadMarkdown(
                `incremento-${increment.number}-${specification.documentType.toLowerCase()}.md`,
                versionForIncrement.content,
              )
            }
          >
            <Download className="size-4" />
          </Button>
        )}
      </div>
      {versionForIncrement ? (
        <MarkdownEditor value={versionForIncrement.content} onChange={() => {}} readOnly />
      ) : (
        <p className="text-sm text-muted-foreground">Não gerado neste incremento.</p>
      )}
    </section>
  );
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
