"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Agent -> district mapping. Colors match the design tokens in globals.css
// (--color-agent-*), so this stays visually consistent with the rest of the
// dashboard rather than inventing a separate palette.
// ---------------------------------------------------------------------------
export type AgentKey = "orchestrator" | "scout" | "scribe" | "reach" | "dev";

export interface AgentActivity {
  key: AgentKey;
  label: string;
  district: string;
  color: string;
  height: number; // relative building height
  position: [number, number, number];
  sessionCount: number;
  lastActivitySecondsAgo: number | null; // null = no data
}

const LIT_WINDOW_THRESHOLD_SECONDS = 2 * 60 * 60; // 2h, matches spec

function isLit(agent: AgentActivity): boolean {
  return agent.lastActivitySecondsAgo !== null && agent.lastActivitySecondsAgo < LIT_WINDOW_THRESHOLD_SECONDS;
}

// ---------------------------------------------------------------------------
// A single building: box geometry + emissive "windows" (small planes) that
// light up when the agent has recent activity. Clicking raises a small
// dossier panel via <Html>.
// ---------------------------------------------------------------------------
function Building({
  agent,
  onSelect,
  selected,
}: {
  agent: AgentActivity;
  onSelect: (key: AgentKey) => void;
  selected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lit = isLit(agent);
  const width = agent.key === "orchestrator" ? 1.6 : 1.1;
  const depth = width;

  useFrame((state) => {
    if (!meshRef.current) return;
    // Gentle idle bob only for the currently-lit buildings — a subtle signal
    // of "live work happening", not a distracting animation for idle towers.
    if (lit) {
      const t = state.clock.getElapsedTime();
      meshRef.current.position.y = agent.position[1] + Math.sin(t * 1.5 + agent.position[0]) * 0.03;
    }
  });

  const windowRows = Math.max(2, Math.floor(agent.height * 1.5));

  return (
    <group position={agent.position}>
      <mesh
        ref={meshRef}
        position={[0, agent.height / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(agent.key);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, agent.height, depth]} />
        <meshStandardMaterial
          color={agent.color}
          emissive={agent.color}
          emissiveIntensity={selected ? 0.55 : lit ? 0.35 : 0.05}
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>

      {/* Window grid: small emissive strips on the front face, lit state
          driven by recent activity rather than being purely decorative. */}
      {Array.from({ length: windowRows }).map((_, row) => (
        <mesh
          key={row}
          position={[0, 0.35 + row * (agent.height / windowRows), depth / 2 + 0.01]}
        >
          <planeGeometry args={[width * 0.7, 0.08]} />
          <meshBasicMaterial
            color={lit ? "#FFE9B8" : "#3a352f"}
            transparent
            opacity={lit ? 0.9 : 0.25}
          />
        </mesh>
      ))}

      {/* Ground-level label */}
      <Text
        position={[0, -0.25, depth / 2 + 0.5]}
        fontSize={0.16}
        color="#f2eee7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.006}
        outlineColor="#16120f"
      >
        {agent.district}
      </Text>

      {selected && (
        <Html position={[0, agent.height + 0.6, 0]} center distanceFactor={8}>
          <div className="bg-[#16120F]/95 text-[#F2EEE7] rounded-xl px-4 py-3 text-xs w-48 shadow-xl border border-white/10 pointer-events-none">
            <div className="font-semibold text-sm mb-1" style={{ color: agent.color }}>
              {agent.label}
            </div>
            <div className="text-white/60">{agent.district}</div>
            <div className="mt-2 flex justify-between">
              <span className="text-white/50">Sessions</span>
              <span className="font-mono">{agent.sessionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Status</span>
              <span className={lit ? "text-[#7CD98A]" : "text-white/40"}>{lit ? "ACTIVE" : "IDLE"}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[16, 16]} />
      <meshStandardMaterial color="#1A1512" roughness={0.9} />
      <gridHelper args={[16, 16, "#2a231d", "#221c17"]} />
    </mesh>
  );
}

function Scene({ agents, selected, onSelect }: { agents: AgentActivity[]; selected: AgentKey | null; onSelect: (k: AgentKey) => void }) {
  return (
    <>
      <color attach="background" args={["#16120F"]} />
      <fog attach="fog" args={["#16120F", 8, 20]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 4]} intensity={0.6} color="#F0A27E" castShadow />
      <pointLight position={[0, 4, 0]} intensity={0.4} color="#E8622C" />

      <GroundPlane />

      {agents.map((agent) => (
        <Building key={agent.key} agent={agent} selected={selected === agent.key} onSelect={onSelect} />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate={false}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component: takes real per-profile stats (fetched server-side by the
// page) and lays out the 5 buildings. No fake data — if a stat is missing,
// the building is simply unlit (IDLE) rather than showing an invented number.
// ---------------------------------------------------------------------------
export interface OfficeSceneProps {
  agents: AgentActivity[];
}

export function OfficeScene({ agents }: OfficeSceneProps) {
  const [selected, setSelected] = useState<AgentKey | null>(null);
  const [ready, setReady] = useState(false);

  const selectedAgent = useMemo(() => agents.find((a) => a.key === selected) ?? null, [agents, selected]);

  return (
    <div className="relative w-full h-[560px] rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-[#16120F]">
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#16120F] text-white/60 text-xs uppercase tracking-[0.2em]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#E8622C] rounded-full animate-spin" />
            Booting the empire...
          </div>
        </div>
      )}
      <Canvas
        shadows
        camera={{ position: [6, 5, 7], fov: 45 }}
        onCreated={() => setReady(true)}
        onPointerMissed={() => setSelected(null)}
      >
        <Suspense fallback={null}>
          <Scene agents={agents} selected={selected} onSelect={setSelected} />
        </Suspense>
      </Canvas>

      {selectedAgent && (
        <button
          onClick={() => setSelected(null)}
          className="absolute top-3 right-3 z-10 text-[10px] uppercase tracking-wider bg-white/10 text-white/70 px-2.5 py-1 rounded-full hover:bg-white/20 transition-colors"
        >
          Close dossier ✕
        </button>
      )}
    </div>
  );
}
