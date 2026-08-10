/** feature 004 FR-017 Acceptance Scenario 3: no task-tracking entity exists yet — explains the gap instead of a dead tab. */
export function TasksTab() {
  return (
    <div className="cockpit-tab">
      <h2>Tasks</h2>
      <p>
        Task-level tracking is not implemented yet. This tab is reserved for a future increment
        that breaks a demand down into individual tasks.
      </p>
    </div>
  );
}
