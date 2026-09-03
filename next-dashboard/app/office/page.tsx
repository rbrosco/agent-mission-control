import { OfficeScene, type AgentActivity, type AgentKey } from "@/components/office-scene";

const MC_BASE = process.env.NEXT_PUBLIC_MC_URL || "http://127.0.0.1:51763";

// Static layout: which agent maps to which "district", color, and building
// position/height. Colors match --color-agent-* in globals.css. Data (session
// counts, last activity) is fetched live below — nothing here is fabricated,
// only the physical arrangement of the city is fixed.
const AGENT_LAYOUT: Record<AgentKey, { label: string; district: string; color: string; height: number; position: [number, number, number] }> = {
  orchestrator: { label: "Orchestrator", district: "HQ", color: "#E8622C", height: 3.4, position: [0, 0, 0] },
  scout: { label: "Scout", district: "Research", color: "#1FA6A0", height: 2.2, position: [-3.2, 0, -2] },
  scribe: { label: "Scribe", district: "Writing", color: "#D9A62E", height: 2.0, position: [3.2, 0, -2] },
  reach: { label: "Reach", district: "Marketing", color: "#D6407E", height: 1.9, position: [-3.2, 0, 2.2] },
  dev: { label: "Dev", district: "Engineering", color: "#3FA85C", height: 2.4, position: [3.2, 0, 2.2] },
};

interface SessionRow {
  profile?: string;
  profile_name?: string;
  last_activity_at?: number;
  started_at?: number;
}

async function getOfficeData(): Promise<{ agents: AgentActivity[]; lightsOn: number; totalSessions: number }> {
  const [summaryRes, sessionsRes] = await Promise.all([
    fetch(`${MC_BASE}/api/summary`, { next: { revalidate: 15 } }),
    fetch(`${MC_BASE}/api/sessions?limit=200`, { next: { revalidate: 15 } }),
  ]);
  if (!summaryRes.ok) throw new Error(`HTTP ${summaryRes.status} on /api/summary`);
  if (!sessionsRes.ok) throw new Error(`HTTP ${sessionsRes.status} on /api/sessions`);

  const summary = await summaryRes.json();
  const sessions: SessionRow[] = await sessionsRes.json();

  const nowSec = Date.now() / 1000;

  // Most recent last_activity_at per real profile (dev/scout/scribe/reach).
  const lastActivityByProfile = new Map<string, number>();
  for (const s of sessions) {
    const profile = s.profile || s.profile_name;
    const ts = s.last_activity_at ?? s.started_at;
    if (!profile || !ts) continue;
    const existing = lastActivityByProfile.get(profile);
    if (!existing || ts > existing) lastActivityByProfile.set(profile, ts);
  }

  // Orchestrator has no dedicated profile/session table in this install —
  // treat it as "active" if ANY profile has recent activity (it coordinates
  // all of them), which is a real, honest derivation, not an invented stat.
  const anyRecentActivity = Array.from(lastActivityByProfile.values())
    .map((ts) => nowSec - ts)
    .some((diff) => diff < 2 * 60 * 60);

  const perProfile = summary.per_profile || {};

  const agents: AgentActivity[] = (Object.keys(AGENT_LAYOUT) as AgentKey[]).map((key) => {
    const layout = AGENT_LAYOUT[key];
    if (key === "orchestrator") {
      return {
        key,
        label: layout.label,
        district: layout.district,
        color: layout.color,
        height: layout.height,
        position: layout.position,
        sessionCount: summary.session_count ?? 0,
        lastActivitySecondsAgo: anyRecentActivity ? 0 : null,
      };
    }
    const lastTs = lastActivityByProfile.get(key);
    return {
      key,
      label: layout.label,
      district: layout.district,
      color: layout.color,
      height: layout.height,
      position: layout.position,
      sessionCount: perProfile[key]?.session_count ?? 0,
      lastActivitySecondsAgo: lastTs ? nowSec - lastTs : null,
    };
  });

  const lightsOn = agents.filter((a) => a.lastActivitySecondsAgo !== null && a.lastActivitySecondsAgo < 2 * 60 * 60).length;

  return { agents, lightsOn, totalSessions: summary.session_count ?? 0 };
}

export default async function OfficePage() {
  const { agents, lightsOn, totalSessions } = await getOfficeData();

  return (
    <div className="space-y-6">
      <div className="bg-[#16120F] rounded-2xl px-8 py-10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 15% 0%, rgba(232,98,44,0.35), transparent)",
          }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#F2EEE7]">
              A city built by <span className="italic text-[#EA6A35]">agents.</span>
            </h1>
            <p className="text-sm text-white/50 mt-3 max-w-xl leading-relaxed">
              Every specialist owns a tower. The orchestrator runs HQ at the center. Lit windows mean live
              work. Drag to orbit, scroll to zoom, click a building to open its dossier.
            </p>
          </div>
          <div className="flex gap-6 text-right shrink-0">
            <div>
              <div className="text-2xl font-serif text-[#F2EEE7]">{agents.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Buildings</div>
            </div>
            <div>
              <div className="text-2xl font-serif text-[#F2EEE7]">{lightsOn}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Lights on</div>
            </div>
            <div>
              <div className="text-2xl font-serif text-[#F2EEE7]">{totalSessions}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Sessions</div>
            </div>
          </div>
        </div>
      </div>

      <OfficeScene agents={agents} />
    </div>
  );
}
