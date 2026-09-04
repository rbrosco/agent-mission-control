import { mcFetchJSON } from "@/lib/mc-api";
import { Card } from "@/components/card";

async function getSchedule() {
  const [executions, jobs] = await Promise.all([
    mcFetchJSON(`/api/cron/executions?limit=100`).catch(() => []),
    mcFetchJSON(`/api/cron/jobs`).catch(() => []),
  ]);
  return { executions, jobs };
}

function statusBadge(status?: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("fail") || s.includes("error")) return { label: "FAIL", cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" };
  if (s.includes("success") || s.includes("complete") || s.includes("ok")) return { label: "OK", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" };
  if (s.includes("run") || s.includes("start")) return { label: "RUN", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" };
  return { label: status ? status.slice(0, 6).toUpperCase() : "—", cls: "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50" };
}

function fmt(sec?: string) {
  if (!sec) return "—";
  const d = new Date(sec);
  if (Number.isNaN(d.getTime())) return sec;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function SchedulePage() {
  const { executions, jobs } = await getSchedule();

  return (
    <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-medium">Schedule</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-2">Cron jobs e execuções da frota, com status em tempo real.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40">Executions</div>
            <div className="text-4xl font-serif font-medium mt-2">{executions.length}</div>
            <div className="text-xs text-black/40 dark:text-white/40 mt-2">Last 100 runs</div>
          </Card>
          <Card>
            <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40">Jobs</div>
            <div className="text-4xl font-serif font-medium mt-2">{jobs.length}</div>
            <div className="text-xs text-black/40 dark:text-white/40 mt-2">Distinct job ids</div>
          </Card>
          <Card>
            <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40">Profiles with cron</div>
            <div className="text-4xl font-serif font-medium mt-2">
              {new Set(executions.map((e: any) => e.profile)).size || "—"}
            </div>
            <div className="text-xs text-black/40 dark:text-white/40 mt-2">From executions</div>
          </Card>
        </div>

        <div className="bg-card dark:bg-cardd rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden">
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
            Recent executions
          </div>
          <div className="divide-y divide-black/5">
            {executions.length === 0 && (
              <div className="text-sm text-black/40 dark:text-white/40 py-8 text-center">Sem execuções registradas.</div>
            )}
            {executions.slice(0, 50).map((e: any) => {
              const badge = statusBadge(e.status);
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{e.job_id}</div>
                    <div className="text-[11px] text-black/40 dark:text-white/40">
                      {e.profile} · {(e as any).source || "cron"} {(e as any).pid ? `· pid ${(e as any).pid}` : ""}
                    </div>
                  </div>
                  <div className="text-[11px] text-black/40 dark:text-white/40 tabular-nums">{fmt(e.claimed_at)}</div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}
