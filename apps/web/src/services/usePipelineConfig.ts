import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "./api";

export interface PipelineStageConfigItem {
  id: string;
  stage: string;
  mode: "AUTO" | "MANUAL";
}

/** feature 006 (pipeline configurável): as 9 etapas do pipeline "developer" — config global da plataforma, leitura livre pra qualquer usuário autenticado. */
export function usePipelineStagesList() {
  return useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => apiGet<PipelineStageConfigItem[]>("/pipeline-stages"),
  });
}

/** requer `PIPELINE_CONFIG_WRITE` — muda se uma etapa roda automaticamente ou pausa pra um clique manual, afeta TODA execução futura da plataforma. */
export function useUpdatePipelineStageMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, mode }: { stage: string; mode: "AUTO" | "MANUAL" }) =>
      apiPatch<PipelineStageConfigItem>(`/pipeline-stages/${stage}`, { mode }),
    meta: { successMessage: "Configuração do pipeline atualizada." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline-stages"] }),
  });
}
