import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { RepositoryMapping } from "../services/useDependencyAnalyzer";

function matches(term: string, ...values: Array<string | null | undefined>): boolean {
  if (!term) return true;
  const needle = term.toLowerCase();
  return values.some((v) => v?.toLowerCase().includes(needle));
}

/**
 * The 3-section dependency-mapping view (Telas→APIs / Rotas expostas /
 * Chamadas de saída) — originally inline in `SystemDetail.tsx`'s "Ver
 * mapeamento" modal, extracted so `SpecificationWorkspace.tsx`'s artifact
 * picker can show the same evidence without duplicating the JSX. Some
 * artifacts carry 100+ entries (a busy frontend Tela, e.g.) — the filter
 * narrows all 3 sections at once by method/URL/screen/controller/service text.
 */
export function DependencyMappingSummary({ mapping }: { mapping: RepositoryMapping }) {
  const [filter, setFilter] = useState("");

  const screens = mapping.screens.filter((call) =>
    matches(filter, call.screenName, call.method, call.url),
  );
  const exposedRoutes = mapping.exposedRoutes.filter((route) =>
    matches(filter, route.method, route.url, route.controllerName, route.serviceName),
  );
  const outboundCalls = mapping.outboundCalls.filter((call) => matches(filter, call.method, call.url));

  return (
    <div className="flex flex-col gap-4 text-sm text-foreground">
      <Input
        type="search"
        placeholder="Filtrar por método, URL, tela, controller ou service…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Telas → APIs chamadas</h3>
          {screens.length === 0 && (
            <p className="text-muted-foreground">
              {mapping.screens.length === 0 ? "Nenhuma chamada mapeada." : "Nenhum resultado para o filtro."}
            </p>
          )}
          {screens.map((call, i) => (
            <div key={i} className="border-b border-border pb-1">
              <strong>{call.screenName}</strong> → {call.method} {call.url}
              <div className="text-xs text-muted-foreground">
                {call.sourceFile}:{call.sourceLine} ({call.confidence})
              </div>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Rotas expostas → Controller → Service</h3>
          {exposedRoutes.length === 0 && (
            <p className="text-muted-foreground">
              {mapping.exposedRoutes.length === 0 ? "Nenhuma rota mapeada." : "Nenhum resultado para o filtro."}
            </p>
          )}
          {exposedRoutes.map((route, i) => (
            <div key={i} className="border-b border-border pb-1">
              {route.method} {route.url} → {route.controllerName ?? "?"} → {route.serviceName ?? "?"}
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Chamadas de API feitas pelo backend</h3>
          {outboundCalls.length === 0 && (
            <p className="text-muted-foreground">
              {mapping.outboundCalls.length === 0 ? "Nenhuma chamada mapeada." : "Nenhum resultado para o filtro."}
            </p>
          )}
          {outboundCalls.map((call, i) => (
            <div key={i} className="border-b border-border pb-1">
              {call.method} {call.url}
              <div className="text-xs text-muted-foreground">
                {call.sourceFile}:{call.sourceLine} ({call.confidence})
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
