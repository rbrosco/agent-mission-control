async function getTasks() {
  const base = process.env.NEXT_PUBLIC_MC_URL || "http://127.0.0.1:51763";
  const res = await fetch(`${base}/api/kanban?limit=100`, { next: { revalidate: 5 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function priorityBadge(priority?: number) {
  const p = Number(priority) || 0;
  if (p >= 2) return { label: "P1", cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" };
  if (p === 1) return { label: "P2", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" };
  return { label: "P3", cls: "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50" };
}

function statusPill(status?: string) {
  const s = (status || "").toLowerCase();
  const label = status || "sem status";
  const cls =
    s.includes("done") || s.includes("complete")
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : s.includes("progress")
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        : s.includes("todo") || s.includes("open")
          ? "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70"
          : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50";
  return { label, cls };
}

export default async function TasksPage() {
  const tasks = await getTasks();

  return (
    <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-medium">Tasks</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-2">Kanban tasks from the global board plus any per-profile boards.</p>
        </div>

        <div className="bg-card dark:bg-cardd rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden">
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
            {tasks.length} tasks
          </div>
          <div className="divide-y divide-black/5">
            {tasks.length === 0 && (
              <div className="text-sm text-black/40 dark:text-white/40 py-8 text-center">Sem tasks no momento.</div>
            )}
            {tasks.map((t: any) => {
              const badge = priorityBadge(t.priority);
              const status = statusPill(t.status);
              return (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-[11px] text-black/40 dark:text-white/40">
                      {t.board} {t.assignee ? `· ${t.assignee}` : ""}
                    </div>
                  </div>
                  <div className="text-[11px] text-black/40 dark:text-white/40 tabular-nums">{t.created_at ? new Date(t.created_at).toLocaleString("pt-BR") : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}
