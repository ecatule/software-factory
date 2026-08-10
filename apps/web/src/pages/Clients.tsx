import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
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
    { header: "Name", accessorKey: "name" },
    { header: "External reference", accessorKey: "externalReference" },
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
    <div className="clients-page">
      <header>
        <h1>Clients</h1>
        <button type="button" onClick={openCreate}>
          New client
        </button>
      </header>

      <DataTable
        columns={columns}
        data={clients ?? []}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="No clients yet — create one to get started."
      />

      <Modal
        title={editing ? "Edit client" : "New client"}
        isOpen={isCreating || editing !== null}
        onClose={() => {
          setIsCreating(false);
          setEditing(null);
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Name" registration={register("name", { required: true })} />
          <FormField
            label="External reference"
            registration={register("externalReference")}
          />
          <button type="submit">Save</button>
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
    <section>
      <h2>Sistemas</h2>
      <ul>
        {activeSystems.map((system) => (
          <li key={system.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(system.id)}
                onChange={() => toggle(system.id)}
              />{" "}
              {system.name}
            </label>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setSystems.mutate(selected)}>
        Save systems
      </button>
    </section>
  );
}
