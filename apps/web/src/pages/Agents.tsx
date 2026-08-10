import { useForm } from "react-hook-form";
import { DataTable } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useAgentsList, useTriggerExecution, type Agent, type TriggerExecutionInput } from "../services/useAgents";
import { useDemandsList } from "../services/useDemands";

/** SDD pipeline stages SpecKitProvider actually understands ("Modo B" — headless Claude Code). */
const PIPELINE_STAGES = ["specify", "clarify", "plan", "checklist", "tasks", "analyze"] as const;

/** spec User Story 9: list the Agent catalog and trigger an execution. */
export function Agents() {
  const { data: agents, isLoading } = useAgentsList();
  const { data: demands } = useDemandsList({ pageSize: 100 });
  const triggerExecution = useTriggerExecution();
  const { register, handleSubmit, reset } = useForm<TriggerExecutionInput>();

  const columns: ColumnDef<Agent, unknown>[] = [
    { header: "Name", accessorKey: "name" },
    { header: "Type", accessorKey: "type" },
  ];

  async function onSubmit(values: TriggerExecutionInput) {
    await triggerExecution.mutateAsync(values);
    reset();
  }

  return (
    <div className="agents-page">
      <h1>Agents</h1>
      <DataTable columns={columns} data={agents ?? []} isLoading={isLoading} />

      <section>
        <h2>Trigger an execution</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-field">
            <label htmlFor="agentId">Agent</label>
            <select id="agentId" {...register("agentId", { required: true })}>
              <option value="">Select an agent…</option>
              {agents?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="demandId">Demand</label>
            <select id="demandId" {...register("demandId", { required: true })}>
              <option value="">Select a demand…</option>
              {demands?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="pipelineStage">Pipeline stage (optional — for the developer agent, always runs "implement")</label>
            <select id="pipelineStage" {...register("pipelineStage")}>
              <option value="">Default (specify)</option>
              {PIPELINE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Trigger</button>
        </form>
      </section>
    </div>
  );
}
