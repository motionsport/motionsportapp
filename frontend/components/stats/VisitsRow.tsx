// «Відвідувань» under a revenue card (the trainer's «Статистика», the owner's «Статистика залу»): ✓ marks on the
// trainer's trainings in the period. Visits, not people: one client coming 8 times is 8
export function VisitsRow({ count }: { count: number }) {
  return (
    <div className="flex justify-between space-x-3 mt-3 pt-3 border-t border-line">
      <span className="text-subtle">
        Відвідувань
        <span className="block text-xs">тренування з ✓, гості теж, без сьогодні</span>
      </span>
      <span className={`tabular-nums ${count ? "text-body" : "text-muted"}`}>{count}</span>
    </div>
  );
}
