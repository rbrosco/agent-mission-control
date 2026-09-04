"use client";

import { useEffect, useState } from "react";
import { mcFetchJSON } from "@/lib/mc-api";
import { useStaggerReveal } from "@/lib/use-stagger-reveal";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";

type Session = {
  id: string;
  profile: string;
  model?: string;
  started_at?: number;
  last_activity_at?: number;
  message_count?: number;
  cwd?: string;
};

const AGENT_META: Record<string, { name: string; role: string; color: string }> = {
  orchestrator: { name: "Orchestrator", role: "COORDINATOR", color: "#E8622C" },
  scout: { name: "Scout", role: "RESEARCH", color: "#1FA6A0" },
  scribe: { name: "Scribe", role: "WRITING", color: "#D9A62E" },
  reach: { name: "Reach", role: "MARKETING", color: "#D6407E" },
  dev: { name: "Dev", role: "ENGINEERING", color: "#3FA85C" },
};

const REAL_PROFILES = ["dev", "scout", "scribe", "reach"];

export default function AgentsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const scope = useStaggerReveal(".stagger-item", [loading]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    mcFetchJSON("/api/sessions?limit=500")
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="loading-shimmer h-40 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="loading-shimmer h-56 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const byProfile: Record<string, Session[]> = {};
  for (const s of sessions) {
    (byProfile[s.profile] ||= []).push(s);
  }

  const agentKeys = ["orchestrator", ...REAL_PROFILES];
  const maxSessions = Math.max(1, ...REAL_PROFILES.map((p) => (byProfile[p] || []).length));

  return (
    <div className="space-y-6" ref={scope}>
      <div className="hero-glow rounded-3xl p-8 md:p-10 text-cream dark:text-cream relative overflow-hidden">
        <h1 className="font-serif text-3xl md:text-5xl font-medium leading-tight">
          Five agents. <em className="italic text-accent">one console.</em>
        </h1>
        <p className="mt-4 text-sm md:text-base text-cream/60 dark:text-cream/60 leading-relaxed max-w-2xl">
          Inspect each specialist, route them to the right model, and watch the heartbeat of the entire fleet in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {agentKeys.map((key) => {
          const meta = AGENT_META[key];
          const isOrch = key === "orchestrator";
          const list = byProfile[key] || [];
          const count = list.length;
          const latestModel = isOrch ? "router (multi-model)" : list[0]?.model || "—";
          const lastActive = list[0]?.last_activity_at;
          const isActive = lastActive ? Date.now() / 1000 - lastActive < 7200 : false;
          const loadPct = isOrch ? 100 : Math.round((count / maxSessions) * 100);

          return (
            <div key={key} className="bg-card dark:bg-cardd rounded-2xl p-5 shadow-sm border border-black/5 dark:border-white/10 stagger-item">
              <div className="flex items-center justify-between mb-3">
                <span
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: meta.color }}
                >
                  {meta.name[0]}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-black/40"
                  }`}
                >
                  {isActive ? "ACTIVE" : "IDLE"}
                </span>
              </div>
              <div className="font-serif text-lg font-medium">{meta.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 mb-3">{meta.role}</div>
              <div className="h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full" style={{ width: `${loadPct}%`, background: meta.color }} />
              </div>
              <div className="text-[10px] text-black/40 dark:text-white/40 mb-3">load</div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-black/40 dark:text-white/40">Sessions</span>
                <span className="font-semibold">{isOrch ? String(sessions.length) : String(count)}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-black/40 dark:text-white/40">Success rate</span>
                <span className="font-semibold">{count ? "100%" : "—"}</span>
              </div>
              <div className="text-[10px] text-black/40 dark:text-white/40 mt-3 truncate">Model: {latestModel}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 mb-3">Task summary</div>
          <div className="space-y-2">
            {REAL_PROFILES.map((p) => {
              const count = (byProfile[p] || []).length;
              return (
                <div key={p} className="flex items-center justify-between text-sm py-2 border-b border-black/5 dark:border-white/10 last:border-0">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: AGENT_META[p]?.color || "#999" }}
                    >
                      {AGENT_META[p]?.name?.[0] || p[0]}
                    </span>
                    {AGENT_META[p]?.name || p}
                  </span>
                  <span className="text-black/50 dark:text-white/50">{count} sessions</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 mb-3">Model routing</div>
          <div className="space-y-2">
            {REAL_PROFILES.map((p) => {
              const list = byProfile[p] || [];
              const model = list[0]?.model || "—";
              return (
                <div key={p} className="flex items-center justify-between text-xs py-2 border-b border-black/5 dark:border-white/10 last:border-0">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: AGENT_META[p]?.color || "#999" }}
                    >
                      {AGENT_META[p]?.name?.[0] || p[0]}
                    </span>
                    {AGENT_META[p]?.name || p}
                  </span>
                  <span className="text-black/50 dark:text-white/50 font-mono truncate max-w-[140px]">{model}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
