"use client";

import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:51763";

type Summary = {
  profiles: string[];
  session_count: number;
  message_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  task_count: number | null;
  task_by_status: Record<string, number>;
  cron_job_count: number | null;
  per_profile: Record<string, { session_count: number; message_count: number; input_tokens: number; output_tokens: number }>;
};

type Message = {
  id: string;
  profile: string;
  role: string;
  content: string;
  timestamp: number;
};

const AGENT_META: Record<string, { name: string; role: string; color: string }> = {
  orchestrator: { name: "Orchestrator", role: "COORDINATOR", color: "#E8622C" },
  scout: { name: "Scout", role: "RESEARCH", color: "#1FA6A0" },
  scribe: { name: "Scribe", role: "WRITING", color: "#D9A62E" },
  reach: { name: "Reach", role: "MARKETING", color: "#D6407E" },
  dev: { name: "Dev", role: "ENGINEERING", color: "#3FA85C" },
};

const REAL_PROFILES = ["dev", "scout", "scribe", "reach"];

function timeAgo(sec?: number) {
  if (!sec) return "—";
  const diff = Date.now() / 1000 - sec;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

function fmtEpoch(sec?: number) {
  if (!sec) return "—";
  const d = new Date(sec * 1000);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function fetchJSON(url: string) {
  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || `HTTP ${resp.status}`);
    // @ts-ignore
    err.status = resp.status;
    throw err;
  }
  return data;
}

export default function OverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [summaryData, messagesData] = await Promise.all([
          fetchJSON(`${API_BASE}/api/summary`),
          fetchJSON(`${API_BASE}/api/messages?limit=8`),
        ]);
        if (!cancelled) {
          setSummary(summaryData);
          setMessages(messagesData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="loading-shimmer h-64 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="loading-shimmer h-40 rounded-3xl" />
          <div className="loading-shimmer h-40 rounded-3xl" />
          <div className="loading-shimmer h-40 rounded-3xl" />
          <div className="loading-shimmer h-40 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-sm">Erro ao carregar overview: {error}</div>;
  }

  if (!summary) return null;

  const perProfile = summary.per_profile || {};
  const totalSessions = Object.values(perProfile).reduce((a, p) => a + (p.session_count || 0), 0) || 1;
  const activeMissions = (summary.task_by_status?.todo || 0) + (summary.task_by_status?.in_progress || 0);

  return (
    <div className="space-y-6">
      {/* Hero + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 hero-glow rounded-3xl p-8 md:p-10 text-cream dark:text-cream relative overflow-hidden">
          <h1 className="font-serif text-3xl md:text-5xl font-medium leading-tight">
            One orchestrator. <em className="italic text-accent">Four specialists.</em>
          </h1>
          <p className="mt-4 text-sm md:text-base text-cream/60 dark:text-cream/60 leading-relaxed max-w-2xl">
            Hermes is coordinating Scout, Scribe, Reach, Dev — routing every task by complexity.
          </p>

          {/* Network graph */}
          <div className="mt-8 relative z-10">
            <svg viewBox="0 0 420 160" className="w-full max-w-xl h-40">
              <line x1="70" y1="80" x2="200" y2="30" stroke="rgba(232,98,44,0.35)" strokeWidth="1.5" />
              <line x1="70" y1="80" x2="340" y2="60" stroke="rgba(232,98,44,0.35)" strokeWidth="1.5" />
              <line x1="70" y1="80" x2="340" y2="130" stroke="rgba(232,98,44,0.35)" strokeWidth="1.5" />
              <line x1="70" y1="80" x2="200" y2="150" stroke="rgba(232,98,44,0.35)" strokeWidth="1.5" />
              <circle cx="70" cy="80" r="22" fill="#E8622C" className="pulse-dot" />
              <circle cx="70" cy="80" r="22" fill="none" stroke="#E8622C" strokeWidth="1" opacity="0.4" />
              <text x="70" y="85" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="Inter">
                h
              </text>
              {[
                { x: 200, y: 30, label: "SC", color: "#1FA6A0" },
                { x: 340, y: 60, label: "SB", color: "#D9A62E" },
                { x: 340, y: 130, label: "RE", color: "#D6407E" },
                { x: 200, y: 150, label: "DV", color: "#3FA85C" },
              ].map((n) => (
                <g key={n.label}>
                  <circle cx={n.x} cy={n.y} r="16" fill={n.color} />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="Inter">
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="bg-card dark:bg-cardd rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 mb-3">Recent activity</div>
          <div className="divide-y divide-black/5">
            {messages.length === 0 && (
              <div className="text-sm text-black/40 dark:text-white/40 py-6 text-center">Sem mensagens recentes.</div>
            )}
            {messages.map((m) => {
              const meta = AGENT_META[m.profile] || { name: m.profile, role: m.role, color: "#999" };
              return (
                <div key={m.id} className="flex items-start gap-3 py-2.5 last:border-0">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0"
                    style={{ background: meta.color }}
                  >
                    {(meta.name || m.profile)[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">
                      {meta.name} · {m.role}
                    </div>
                    <div className="text-xs text-black/50 dark:text-white/50 truncate">{(m.content || "").slice(0, 90)}</div>
                  </div>
                  <div className="text-[10px] text-black/35 dark:text-white/35 shrink-0">{timeAgo(m.timestamp)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card dark:bg-cardd rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/10">
          <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40">Active Missions</div>
          <div className="text-4xl font-serif font-medium mt-2">{activeMissions}</div>
          <div className="text-xs text-black/40 dark:text-white/40 mt-2">To do + In progress · kanban.db</div>
        </div>

        <div className="bg-card dark:bg-cardd rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/10">
          <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40">Load distribution</div>
          <LoadRing total={totalSessions} perProfile={perProfile} />
          <div className="text-[10px] text-black/40 dark:text-white/40 text-center mt-1">sessions por agente</div>
        </div>

        <div className="bg-card dark:bg-cardd rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/10">
          <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40 mb-2">Sessions by agent</div>
          <div className="space-y-1">
            {REAL_PROFILES.map((p) => {
              const count = perProfile[p]?.session_count || 0;
              return (
                <div key={p} className="flex items-center justify-between text-xs py-1.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: AGENT_META[p]?.color || "#999" }}
                    >
                      {AGENT_META[p]?.name?.[0] || p[0]}
                    </span>
                    {AGENT_META[p]?.name || p}
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card dark:bg-cardd rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/10">
          <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40 mb-3">Fleet throughput</div>
          <div className="space-y-2.5">
            {REAL_PROFILES.map((p) => {
              const count = perProfile[p]?.session_count || 0;
              const maxCount = Math.max(1, ...REAL_PROFILES.map((x) => perProfile[x]?.session_count || 0));
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={p}>
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 mb-1">
                    <span>{AGENT_META[p]?.name || p}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: AGENT_META[p]?.color || "#999" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadRing({ total, perProfile }: { total: number; perProfile: Record<string, any> }) {
  const segments = REAL_PROFILES.map((p) => {
    const count = perProfile[p]?.session_count || 0;
    return { p, count, pct: (count / total) * 100 };
  });

  let acc = 0;
  const gradientParts = segments
    .map((s) => {
      const start = acc;
      acc += s.pct;
      const color = AGENT_META[s.p]?.color || "#999";
      return `${color} ${start}% ${acc}%`;
    })
    .join(", ");

  return (
    <div className="relative flex items-center justify-center mt-3">
      <div
        className="w-28 h-28 rounded-full"
        style={{ background: `conic-gradient(${gradientParts || "#ddd 0% 100%"})` }}
      />
      <div className="absolute w-16 h-16 rounded-full bg-card dark:bg-cardd flex items-center justify-center text-xs font-semibold">
        {total}
      </div>
    </div>
  );
}
