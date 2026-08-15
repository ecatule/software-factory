import { useForm } from "react-hook-form";
import { DataTable } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Agents</h1>
      <DataTable columns={columns} data={agents ?? []} isLoading={isLoading} />

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Trigger an execution</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="agentId" className="text-sm font-medium text-foreground">
              Agent
            </label>
            <NativeSelect id="agentId" {...register("agentId", { required: true })}>
              <option value="">Select an agent…</option>
              {agents?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="demandId" className="text-sm font-medium text-foreground">
              Demand
            </label>
            <NativeSelect id="demandId" {...register("demandId", { required: true })}>
              <option value="">Select a demand…</option>
              {demands?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pipelineStage" className="text-sm font-medium text-foreground">
              Pipeline stage (optional — for the developer agent, always runs "implement")
            </label>
            <NativeSelect id="pipelineStage" {...register("pipelineStage")}>
              <option value="">Default (specify)</option>
              {PIPELINE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" className="self-start">
            Trigger
          </Button>
        </form>
      </section>
    </div>
  );
}
