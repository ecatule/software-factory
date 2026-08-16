/** feature 004 FR-017 Acceptance Scenario 3: no task-tracking entity exists yet — explains the gap instead of a dead tab. */
export function TasksTab() {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Tarefas</h2>
      <p className="text-sm text-muted-foreground">
        O rastreamento em nível de tarefa ainda não foi implementado. Esta aba está reservada para
        um incremento futuro que divide uma demanda em tarefas individuais.
      </p>
    </div>
  );
}
