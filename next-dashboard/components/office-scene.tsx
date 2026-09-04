"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
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

// Status color scheme: BLUE = agent actively in use right now, GRAY = idle.
// Building bodies encode status (not identity) — the agent's own color
// survives only as a thin accent stripe, so status reads instantly while
// identity stays a click away. Window emissive intensities are pushed high
// on purpose: the bloom pass (see <Bloom> below) only blooms pixels above
// its luminance threshold, so this is what actually produces the glow.
const STATUS_BLUE = "#3B82F6";
const STATUS_BLUE_EMISSIVE = "#60A5FA";
const STATUS_GRAY = "#4B5563";
const STATUS_GRAY_EMISSIVE = "#6B7280";
const WINDOW_LIT_COLOR = "#BFE3FF";
const WINDOW_DIM_COLOR = "#374151";

function isLit(agent: AgentActivity): boolean {
  return agent.lastActivitySecondsAgo !== null && agent.lastActivitySecondsAgo < LIT_WINDOW_THRESHOLD_SECONDS;
}

// ---------------------------------------------------------------------------
// A single building, composed from several primitives instead of one bare
// box — a bare cube reads as a floating block, not architecture. Structure:
//   - foundation slab: wider+flatter than the tower, grounds it visually so
//     it doesn't look like it's floating over the plaza
//   - tower body: the main volume, colored by status (blue=active/gray=idle)
//   - roof cap: slightly inset box on top with a parapet lip + a thin
//     antenna/spire, so every building reads as "has a top" not "cut off"
//   - window grid: real rows x columns of individual small panes on all
//     four facades (not 3 horizontal stripes), built with nested loops so
//     window count scales with building height/width
// Windows are unlit MeshBasicMaterial (self-illuminated panes, correct
// per the threejs stack guidance — they don't need to react to scene
// lights). Lit windows are pushed past 1.0 brightness so <Bloom>'s
// luminance threshold picks them out selectively.
// ---------------------------------------------------------------------------
function WindowGrid({
  width,
  height,
  depth,
  lit,
  cols,
  rows,
}: {
  width: number;
  height: number;
  depth: number;
  lit: boolean;
  cols: number;
  rows: number;
}) {
  const paneW = (width * 0.82) / cols;
  const paneH = Math.min(0.11, (height * 0.7) / rows);
  const marginTop = height * 0.12; // leave room for the roofline
  const marginBottom = height * 0.1; // leave room for the foundation/entry

  const panes: { x: number; y: number }[] = [];
  const usableH = height - marginTop - marginBottom;
  const rowGap = rows > 1 ? usableH / (rows - 1) : 0;
  const colSpan = width * 0.82;
  const colGap = cols > 1 ? colSpan / (cols - 1) : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      panes.push({
        x: -colSpan / 2 + c * colGap,
        y: marginBottom + r * rowGap,
      });
    }
  }

  const color = lit ? WINDOW_LIT_COLOR : WINDOW_DIM_COLOR;
  const opacity = lit ? 1 : 0.4;

  // Render the same pane grid on front and back facades (the two faces the
  // camera actually sees from its default orbit range) — side facades stay
  // plain to keep the draw call count sane across 5 buildings x N panes.
  return (
    <>
      {panes.map((p, i) => (
        <mesh key={`f${i}`} position={[p.x, p.y, depth / 2 + 0.01]}>
          <planeGeometry args={[paneW * 0.7, paneH]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={opacity} />
        </mesh>
      ))}
      {panes.map((p, i) => (
        <mesh key={`b${i}`} position={[p.x, p.y, -depth / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[paneW * 0.7, paneH]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={opacity} />
        </mesh>
      ))}
    </>
  );
}

function Building({
  agent,
  onSelect,
  selected,
}: {
  agent: AgentActivity;
  onSelect: (key: AgentKey) => void;
  selected: boolean;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const lit = isLit(agent);
  const width = agent.key === "orchestrator" ? 1.6 : 1.1;
  const depth = width;
  const foundationH = 0.16;
  const roofH = 0.14;
  const bodyH = agent.height;
  const totalH = foundationH + bodyH + roofH;
  const cols = agent.key === "orchestrator" ? 5 : 3;
  const rows = Math.max(2, Math.round(bodyH * 2.2));

  useFrame((state) => {
    if (!meshRef.current) return;
    // Gentle idle bob only for the currently-lit buildings — a subtle signal
    // of "live work happening", not a distracting animation for idle towers.
    if (lit) {
      const t = state.clock.getElapsedTime();
      meshRef.current.position.y = agent.position[1] + Math.sin(t * 1.5 + agent.position[0]) * 0.025;
    }
  });

  return (
    <group position={agent.position} ref={meshRef}>
      {/* Foundation slab: wider + flatter than the tower, grounds it so the
          building reads as sitting ON the plaza, not floating above it. */}
      <mesh position={[0, foundationH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[width * 1.18, foundationH, depth * 1.18]} />
        <meshStandardMaterial color="#0F0D0B" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Tower body — the clickable volume. */}
      <mesh
        position={[0, foundationH + bodyH / 2, 0]}
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
        <boxGeometry args={[width, bodyH, depth]} />
        <meshStandardMaterial
          color={lit ? STATUS_BLUE : STATUS_GRAY}
          emissive={lit ? STATUS_BLUE_EMISSIVE : STATUS_GRAY_EMISSIVE}
          emissiveIntensity={selected ? 0.55 : lit ? 0.32 : 0.06}
          roughness={0.45}
          metalness={0.25}
        />
      </mesh>

      <group position={[0, foundationH, 0]}>
        <WindowGrid width={width} height={bodyH} depth={depth} lit={lit} cols={cols} rows={rows} />
      </group>

      {/* Roof cap: inset box + thin parapet lip, so the top is a distinct
          architectural feature instead of the tower just stopping abruptly. */}
      <mesh position={[0, foundationH + bodyH + roofH / 2, 0]} castShadow>
        <boxGeometry args={[width * 0.92, roofH, depth * 0.92]} />
        <meshStandardMaterial color="#0F0D0B" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Rooftop antenna/spire — small detail that reads as "this is a
          building, not a placeholder box" at a glance. */}
      <mesh position={[0, foundationH + bodyH + roofH + 0.18, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.36, 6]} />
        <meshStandardMaterial color={lit ? STATUS_BLUE_EMISSIVE : "#3a3a3a"} emissive={lit ? STATUS_BLUE_EMISSIVE : "#000"} emissiveIntensity={lit ? 0.6 : 0} />
      </mesh>

      {/* Identity accent stripe: thin vertical corner pilaster in the
          agent's own color (from globals.css), so who-is-who stays readable
          even though the building body itself now encodes status. */}
      <mesh position={[width / 2 + 0.02, foundationH + bodyH / 2, depth / 2 + 0.02]}>
        <boxGeometry args={[0.05, bodyH, 0.05]} />
        <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={0.35} roughness={0.5} />
      </mesh>

      {/* Ground-level label */}
      <Text
        position={[0, -0.18, depth / 2 + 0.65]}
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
        <Html position={[0, totalH + 0.6, 0]} center distanceFactor={8}>
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
              <span className={lit ? "text-[#60A5FA]" : "text-white/40"}>{lit ? "EM USO" : "OCIOSO"}</span>
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

      {/* enableDamping smooths every orbit/zoom input into inertial motion
          instead of snapping 1:1 with the mouse — controls.update() must run
          every frame for damping to take effect, which R3F's <OrbitControls>
          already does internally via its own useFrame. */}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate={false}
      />

      {/* Selective bloom: only pixels above luminanceThreshold glow, so lit
          (blue) windows/emissive stripes bloom while dim (gray/idle)
          surfaces stay flat. mipmapBlur keeps the blur cheap at any
          resolution instead of a fixed-radius Gaussian pass. */}
      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.35}
          luminanceSmoothing={0.2}
          intensity={0.85}
          mipmapBlur
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.15} darkness={0.6} />
      </EffectComposer>
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
  const activeCount = useMemo(() => agents.filter(isLit).length, [agents]);

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
        dpr={[1, 1.5]}
        camera={{ position: [8, 7, 9], fov: 42 }}
        onCreated={() => setReady(true)}
        onPointerMissed={() => setSelected(null)}
      >
        <Suspense fallback={null}>
          <Scene agents={agents} selected={selected} onSelect={setSelected} />
        </Suspense>
      </Canvas>

      {/* Legend + live counter: always visible, top-left, doesn't require a
          click to understand the color language of the scene. */}
      <div className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-sm rounded-xl px-3.5 py-2.5 text-[11px] text-white/80 space-y-1.5 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_BLUE }} />
          <span>Em uso agora</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_GRAY }} />
          <span>Ocioso</span>
        </div>
        <div className="pt-1.5 mt-1.5 border-t border-white/10 font-mono text-white">
          {activeCount} / {agents.length} ativos
        </div>
      </div>

      {selectedAgent && (
        <button
          onClick={() => setSelected(null)}
          className="absolute top-3 right-3 z-10 text-[10px] uppercase tracking-wider bg-white/10 text-white/70 px-2.5 py-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
        >
          Close dossier ✕
        </button>
      )}
    </div>
  );
}
