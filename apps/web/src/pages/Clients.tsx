import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientsList, useCreateClient, useUpdateClient } from "../services/useClients";
import { useClientSystems, useSetClientSystems, useSystemsList } from "../services/useSystems";
import type { Client } from "../services/types";

interface ClientFormValues {
  name: string;
  externalReference?: string;
}

/** spec User Story 3: list, create, and edit Clients. */
export function Clients() {
  const { data: clients, isLoading } = useClientsList();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const [editing, setEditing] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { register, handleSubmit, reset } = useForm<ClientFormValues>();

  const columns: ColumnDef<Client, unknown>[] = [
    { header: "Nome", accessorKey: "name" },
    { header: "Referência externa", accessorKey: "externalReference" },
  ];

  function openCreate() {
    reset({ name: "", externalReference: "" });
    setIsCreating(true);
  }

  function openEdit(client: Client) {
    reset({ name: client.name, externalReference: client.externalReference ?? "" });
    setEditing(client);
  }

  async function onSubmit(values: ClientFormValues) {
    if (editing) {
      await updateClient.mutateAsync({ id: editing.id, ...values });
      setEditing(null);
    } else {
      await createClient.mutateAsync(values);
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
        <Button type="button" onClick={openCreate}>
          <Plus /> Novo cliente
        </Button>
      </header>

      <DataTable
        columns={columns}
        data={clients ?? []}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="Nenhum cliente ainda — crie um para começar."
      />

      <Modal
        title={editing ? "Editar cliente" : "Novo cliente"}
        isOpen={isCreating || editing !== null}
        onClose={() => {
          setIsCreating(false);
          setEditing(null);
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField label="Nome" registration={register("name", { required: true })} />
          <FormField label="Referência externa" registration={register("externalReference")} />
          <Button type="submit" className="self-start">
            Salvar
          </Button>
        </form>
        {editing && <ClientSystems clientId={editing.id} />}
      </Modal>
    </div>
  );
}

/** feature 005 User Story 2: Sistemas associados a este Cliente (N:N). */
function ClientSystems({ clientId }: { clientId: string }) {
  const { data: allSystems } = useSystemsList();
  const { data: associated } = useClientSystems(clientId);
  const setSystems = useSetClientSystems(clientId);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (associated) setSelected(associated.map((s) => s.id));
  }, [associated]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    );
  }

  const activeSystems = allSystems?.items.filter((s) => s.stAtivo) ?? [];

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="text-sm font-semibold text-foreground">Sistemas</h2>
      <ul className="flex flex-col gap-1.5">
        {activeSystems.map((system) => (
          <li key={system.id}>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selected.includes(system.id)}
                onChange={() => toggle(system.id)}
                className="size-4 rounded border-input accent-primary"
              />
              {system.name}
            </label>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setSystems.mutate(selected)}>
        Salvar sistemas
      </Button>
    </section>
  );
}
