import { useState } from "react";
import { Badge } from "@software-factory/ui";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { useAuth } from "../context/AuthContext";
import { useDemandsList, type EnrichedDemand } from "../services/useDemands";
import {
  GMUD_ENVIRONMENT_LABELS,
  useCreateGmudRequest,
  useGmudArtifactsPreview,
  useGmudRequestsForDemand,
  type GmudEnvironment,
} from "../services/useGmud";

/**
 * Governança — GMUD (Gestão de Mudanças): abre uma solicitação de deploy no
 * board fixo do Monday ("Gestão de mudanças", grupo "Socitações de deploy")
 * a partir de uma Demanda já cadastrada — Cliente e Artefatos vêm da
 * Demanda, só o Ambiente é escolhido na tela.
 */
export function Gmud() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("GMUD_WRITE");
  const { data: demandsData } = useDemandsList({ pageSize: 100 });
  const [selectedDemandId, setSelectedDemandId] = useState<string>("");
  const [environment, setEnvironment] = useState<GmudEnvironment>("HOMOLOGACAO");

  const selectedDemand: EnrichedDemand | undefined = demandsData?.items.find(
    (d) => d.id === selectedDemandId,
  );
  const { data: artifactsData } = useGmudArtifactsPreview(selectedDemandId || null);
  const { data: history } = useGmudRequestsForDemand(selectedDemandId || null);
  const createGmud = useCreateGmudRequest();

  async function submit() {
    if (!selectedDemandId) return;
    await createGmud.mutateAsync({ demandId: selectedDemandId, environment });
  }

  const artifacts = artifactsData ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">GMUD — Gestão de Mudanças</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Abre uma solicitação de deploy no Monday para a Demanda selecionada.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gmudDemand" className="text-sm font-medium text-foreground">
            Demanda
          </label>
          <NativeSelect
            id="gmudDemand"
            value={selectedDemandId}
            onChange={(e) => setSelectedDemandId(e.target.value)}
          >
            <option value="">Selecione uma demanda…</option>
            {demandsData?.items.map((d) => (
              <option key={d.id} value={d.id}>
                {d.externalId} — {d.title}
              </option>
            ))}
          </NativeSelect>
        </div>

        {selectedDemand && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Cliente</span>
              <p className="text-sm text-muted-foreground">{selectedDemand.clientName}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="gmudEnvironment" className="text-sm font-medium text-foreground">
                Ambiente
              </label>
              <NativeSelect
                id="gmudEnvironment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as GmudEnvironment)}
                className="max-w-xs"
              >
                <option value="HOMOLOGACAO">Homologação</option>
                <option value="PRODUCAO">Produção</option>
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Apis / Telas para atualização (prévia)
              </span>
              {artifacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum artefato selecionado nesta demanda.</p>
              ) : (
                <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                  {artifacts.map((a) => (
                    <li key={a.id}>
                      {a.name}
                      {a.description && a.description !== a.name ? ` — ${a.description}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canWrite && (
              <Button
                type="button"
                onClick={submit}
                disabled={createGmud.isPending}
                className="self-start"
              >
                Abrir GMUD
              </Button>
            )}
          </>
        )}
      </section>

      {selectedDemand && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico de solicitações
          </h2>
          {!history?.length && (
            <p className="text-sm text-muted-foreground">Nenhuma GMUD aberta ainda para esta demanda.</p>
          )}
          <ul className="flex flex-col gap-2">
            {history?.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <Badge label={GMUD_ENVIRONMENT_LABELS[request.environment]} />
                  {new Date(request.createdAt).toLocaleString("pt-BR")}
                </span>
                <a
                  href={request.mondayItemUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Ver no Monday <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
