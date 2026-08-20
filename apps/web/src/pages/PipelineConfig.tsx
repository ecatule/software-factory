import { pipelineStageLabel } from "../services/useExecutions";
import { usePipelineStagesList, useUpdatePipelineStageMode } from "../services/usePipelineConfig";
import { useAuth } from "../context/AuthContext";

/**
 * feature 006 (pipeline configurável): config GLOBAL da plataforma — quais
 * das 9 etapas do pipeline "developer" (ExecutionsProcessor) rodam
 * automaticamente e quais pausam pra um clique manual ("Avançar etapa" na
 * tela Execuções). Todas `AUTO` por padrão.
 */
export function PipelineConfig() {
  const { hasPermission } = useAuth();
  const { data: stages, isLoading } = usePipelineStagesList();
  const updateMode = useUpdatePipelineStageMode();
  const canWrite = hasPermission("PIPELINE_CONFIG_WRITE");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuração do Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controla, pra TODA execução do Developer Agent na plataforma, se cada etapa roda automaticamente ou
          pausa aguardando um clique manual ("Avançar etapa", na tela Execuções). Padrão: todas automáticas.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <ul className="flex flex-col gap-2">
        {stages?.map((stage) => (
          <li
            key={stage.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{pipelineStageLabel(stage.stage)}</p>
              <p className="text-xs text-muted-foreground">{stage.stage}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={stage.mode === "MANUAL"}
                disabled={!canWrite || updateMode.isPending}
                onChange={(e) =>
                  updateMode.mutate({ stage: stage.stage, mode: e.target.checked ? "MANUAL" : "AUTO" })
                }
              />
              Manual
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
