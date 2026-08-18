import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiPut } from "./api";
import type { PaginatedResult } from "./types";

/** feature 005: catálogo técnico reutilizável de Sistemas/Artefatos, independente de Project/Artifact. */
export interface System {
  id: string;
  name: string;
  description: string | null;
  stAtivo: boolean;
}

export interface SystemArtifact {
  id: string;
  systemId: string;
  name: string;
  type: string;
  technology: string | null;
  description: string | null;
  stAtivo: boolean;
  /** follow-up: catalog-level link to real Repository row(s) — lets a demand's selection of this SystemArtifact provision a real, clonable Artifact (see DemandsService.ensureArtifactsForSystemArtifacts). */
  repositories?: { repositoryId: string }[];
}

export function useSystemsList(page = 1) {
  return useQuery({
    queryKey: ["systems", { page }],
    queryFn: () => apiGet<PaginatedResult<System>>(`/systems?page=${page}&page_size=100`),
  });
}

/** follow-up: the System edit screen is a dedicated page now, needs a single-record fetch. */
export function useSystem(id: string | undefined) {
  return useQuery({
    queryKey: ["system", id],
    queryFn: () => apiGet<System>(`/systems/${id}`),
    enabled: !!id,
  });
}

export interface SystemInput {
  name: string;
  description?: string;
}

export function useCreateSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SystemInput) => apiPost<System>("/systems", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["systems"] }),
  });
}

export function useUpdateSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: SystemInput & { id: string; stAtivo?: boolean }) =>
      apiPatch<System>(`/systems/${id}`, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      queryClient.invalidateQueries({ queryKey: ["system", id] });
    },
  });
}

/**
 * follow-up: a Sistema can carry hundreds of Artefatos (real case: ~300 for
 * "Vexur") — paginated + searchable by name, instead of the original
 * unbounded list.
 */
export function useSystemArtifacts(systemId: string | null, search: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (search) params.set("search", search);
  return useQuery({
    queryKey: ["system", systemId, "artifacts", { search, page }],
    queryFn: () =>
      apiGet<PaginatedResult<SystemArtifact>>(`/systems/${systemId}/artifacts?${params}`),
    enabled: systemId !== null,
  });
}

export interface SystemArtifactInput {
  name: string;
  type: string;
  technology?: string;
  description?: string;
  repositoryIds?: string[];
}

function invalidateSystemArtifacts(queryClient: ReturnType<typeof useQueryClient>, systemId: string) {
  // matches every {search,page} variant cached under this key prefix
  return queryClient.invalidateQueries({ queryKey: ["system", systemId, "artifacts"] });
}

export function useCreateSystemArtifact(systemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SystemArtifactInput) =>
      apiPost<SystemArtifact>(`/systems/${systemId}/artifacts`, input),
    onSuccess: () => invalidateSystemArtifacts(queryClient, systemId),
  });
}

export function useUpdateSystemArtifact(systemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: SystemArtifactInput & { id: string; stAtivo?: boolean }) =>
      apiPatch<SystemArtifact>(`/system-artifacts/${id}`, input),
    onSuccess: () => invalidateSystemArtifacts(queryClient, systemId),
  });
}

export interface BulkArtifactResult {
  row: number;
  status: "created" | "error";
  name: string;
  message?: string;
}

/** follow-up: upload a spreadsheet of known Artefatos in one go, instead of one-by-one. */
export function useBulkCreateSystemArtifacts(systemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artifacts: SystemArtifactInput[]) =>
      apiPost<BulkArtifactResult[]>(`/systems/${systemId}/artifacts/bulk`, { artifacts }),
    onSuccess: () => invalidateSystemArtifacts(queryClient, systemId),
  });
}

/**
 * "Todos os artefatos precisam ter um repositório linked" — bulk-links a
 * chosen Repository to every currently ACTIVE artifact of this Sistema that
 * has no active repository link yet (artifacts already linked are
 * untouched). Returns how many got linked.
 */
export function useLinkRepositoryToUnlinkedArtifacts(systemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) =>
      apiPost<{ linked: number }>(`/systems/${systemId}/artifacts/link-repository`, { repositoryId }),
    meta: { successMessage: "Vínculo de repositório atualizado." },
    onSuccess: () => invalidateSystemArtifacts(queryClient, systemId),
  });
}

/** feature 005 User Story 2: Cliente×Sistema association (N:N). */
export function useClientSystems(clientId: string | null) {
  return useQuery({
    queryKey: ["client", clientId, "systems"],
    queryFn: () => apiGet<System[]>(`/clients/${clientId}/systems`),
    enabled: clientId !== null,
  });
}

export function useSetClientSystems(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (systemIds: string[]) =>
      apiPut<System[]>(`/clients/${clientId}/systems`, { systemIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client", clientId, "systems"] }),
  });
}

/** feature 005 User Story 3: Sistemas/Artefatos selecionados numa demanda. */
export interface DemandSystemsResponse {
  available: System[];
  selected: System[];
}

export interface DemandSystemArtifactsResponse {
  available: SystemArtifact[];
  selected: SystemArtifact[];
}

export function useDemandSystems(demandId: string | null) {
  return useQuery({
    queryKey: ["demand", demandId, "systems"],
    queryFn: () => apiGet<DemandSystemsResponse>(`/demands/${demandId}/systems`),
    enabled: demandId !== null,
  });
}

export function useSetDemandSystems(demandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (systemIds: string[]) =>
      apiPut<DemandSystemsResponse>(`/demands/${demandId}/systems`, { systemIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand", demandId, "systems"] });
      queryClient.invalidateQueries({ queryKey: ["demand", demandId, "system-artifacts"] });
    },
  });
}

/**
 * follow-up: `available` is capped server-side (top 50 by name) unless a
 * `search` term narrows it down — avoids rendering hundreds of checkboxes
 * when a demand's selected Sistema has a large catalog.
 *
 * follow-up: `systemIds` passes the SPEC screen's current (not yet saved)
 * System checkboxes, so a System just checked — before "Salvar seleção" is
 * clicked — already lists its Artefatos in the autocomplete instead of
 * falling back to the last-persisted selection.
 */
export function useDemandSystemArtifacts(
  demandId: string | null,
  search = "",
  systemIds: string[] = [],
) {
  return useQuery({
    queryKey: ["demand", demandId, "system-artifacts", { search, systemIds }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (systemIds.length) params.set("systemIds", systemIds.join(","));
      const query = params.toString();
      return apiGet<DemandSystemArtifactsResponse>(
        `/demands/${demandId}/system-artifacts${query ? `?${query}` : ""}`,
      );
    },
    enabled: demandId !== null,
  });
}

export function useSetDemandSystemArtifacts(demandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (systemArtifactIds: string[]) =>
      apiPut<DemandSystemArtifactsResponse>(`/demands/${demandId}/system-artifacts`, {
        systemArtifactIds,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["demand", demandId, "system-artifacts"] }),
  });
}
