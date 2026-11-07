"use client";
/**
 * Editor3D.tsx — Blender-style 3D viewport with XYZ gizmos, grid, axes and a properties panel.
 *
 * Install:  npm i three @react-three/fiber @react-three/drei   (and: npm i -D @types/three)
 * Versions: React 19 -> r3f 9 + drei 10.  React 18 -> r3f 8 + drei 9.
 * Usage:    <div style={{ height: "100vh" }}><Editor3D height="100%" /></div>
 *
 * Mouse:  left/middle-drag orbit · right-drag pan · wheel zoom · click object to select · click empty space to deselect
 * Keys (while pointer is over the editor):
 *   Q select · G move · R rotate · S scale · X/Del delete · Shift+D duplicate · F focus · N side panel
 *   1 front · 3 right · 7 top · 0 perspective · Esc deselect
 * Axis colours follow Blender: X red, Y green, Z blue (Y is up, as in three.js / Spline).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Edges, GizmoHelper, GizmoViewport, Grid, Html, Line, OrbitControls,
  OrthographicCamera, PerspectiveCamera, TransformControls,
} from "@react-three/drei";
import * as THREE from "three";

/* ───────────── types & data ───────────── */
export type V3 = [number, number, number];
export type Kind = "box" | "sphere" | "cylinder" | "cone" | "torus" | "plane";
export interface SceneObject {
  id: string; name: string; kind: Kind;
  position: V3; rotation: V3 /* radians */; scale: V3;
  color: string; visible: boolean;
}
type Tool = "select" | "translate" | "rotate" | "scale";
type Shading = "solid" | "wire" | "both";
type ViewKind = "front" | "right" | "top" | "iso" | "focus";

const C = { x: "#ff3653", y: "#8adb00", z: "#2c8fff", sel: "#ffa028" };
const KINDS: Record<Kind, { label: string; y: number; rot: V3 }> = {
  box: { label: "Cube", y: 0.5, rot: [0, 0, 0] },
  sphere: { label: "Sphere", y: 0.5, rot: [0, 0, 0] },
  cylinder: { label: "Cylinder", y: 0.5, rot: [0, 0, 0] },
  cone: { label: "Cone", y: 0.5, rot: [0, 0, 0] },
  torus: { label: "Torus", y: 0.18, rot: [Math.PI / 2, 0, 0] },
  plane: { label: "Plane", y: 0, rot: [-Math.PI / 2, 0, 0] },
};
const PALETTE = ["#c8c8c8", "#d98c5f", "#7fb2d9", "#9ccf8a", "#d9c36a", "#b58fd9"];
const uid = () => Math.random().toString(36).slice(2, 9);

function makeObject(kind: Kind, existing: SceneObject[], at: V3 = [0, 0, 0]): SceneObject {
  const base = KINDS[kind].label;
  let n = 0, name = base;
  while (existing.some((o) => o.name === name)) name = `${base}.${String(++n).padStart(3, "0")}`;
  return {
    id: uid(), name, kind, position: [at[0], KINDS[kind].y, at[2]], rotation: [...KINDS[kind].rot],
    scale: [1, 1, 1], color: PALETTE[existing.length % PALETTE.length], visible: true,
  };
}
const SEED: SceneObject[] = (() => {
  const list: SceneObject[] = [];
  for (const [k, x, z] of [["box", 0, 0], ["sphere", 2.5, 0], ["cone", -2.5, 0.5], ["torus", 0, -2.5]] as [Kind, number, number][])
    list.push(makeObject(k, list, [x, 0, z]));
  return list;
})();

/* ───────────── 3D scene pieces ───────────── */
function Geo({ kind }: { kind: Kind }) {
  switch (kind) {
    case "box": return <boxGeometry args={[1, 1, 1]} />;
    case "sphere": return <sphereGeometry args={[0.5, 32, 16]} />;
    case "cylinder": return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
    case "cone": return <coneGeometry args={[0.5, 1, 32]} />;
    case "torus": return <torusGeometry args={[0.5, 0.18, 16, 48]} />;
    case "plane": return <planeGeometry args={[2, 2]} />;
  }
}

interface MeshProps {
  o: SceneObject; selected: boolean; shading: Shading; vertices: boolean;
  register: (id: string, obj: THREE.Object3D | null) => void;
  onSelect: (id: string) => void;
}
const SceneMesh = memo(function SceneMesh({ o, selected, shading, vertices, register, onSelect }: MeshProps) {
  return (
    <mesh
      ref={(m) => { register(o.id, m); }}
      position={o.position} rotation={o.rotation} scale={o.scale} visible={o.visible}
      onClick={(e) => { e.stopPropagation(); onSelect(o.id); }}
    >
      <Geo kind={o.kind} />
      <meshStandardMaterial
        color={o.color} roughness={0.55} metalness={0.05} wireframe={shading === "wire"}
        side={o.kind === "plane" ? THREE.DoubleSide : THREE.FrontSide}
        polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1}
      />
      {shading === "both" && (
        <mesh><Geo kind={o.kind} /><meshBasicMaterial wireframe color="#000" transparent opacity={0.35} /></mesh>
      )}
      {selected && <Edges threshold={15} color={C.sel} />}
      {selected && vertices && (
        <points><Geo kind={o.kind} /><pointsMaterial size={6} sizeAttenuation={false} color={C.sel} /></points>
      )}
    </mesh>
  );
});

const LINE_X: V3[] = [[-500, 0, 0], [500, 0, 0]];
const LINE_Y: V3[] = [[0, 0, 0], [0, 500, 0]];
const LINE_Z: V3[] = [[0, 0, -500], [0, 0, 500]];
const TICKS = [-10, -8, -6, -4, -2, 2, 4, 6, 8, 10];

function Tick({ p, text, color }: { p: V3; text: string; color: string }) {
  return (
    <Html position={p} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <span className="b3d-tick" style={{ color }}>{text}</span>
    </Html>
  );
}

function Axes({ labels }: { labels: boolean }) {
  return (
    <group>
      <Line points={LINE_X} color={C.x} lineWidth={1.5} />
      <Line points={LINE_Z} color={C.z} lineWidth={1.5} />
      <Line points={LINE_Y} color={C.y} lineWidth={1.5} />
      {labels && (
        <>
          {TICKS.map((t) => <Tick key={`x${t}`} p={[t, 0, 0.4]} text={String(t)} color={C.x} />)}
          {TICKS.map((t) => <Tick key={`z${t}`} p={[0.4, 0, t]} text={String(t)} color={C.z} />)}
          {[1, 2, 3, 4, 5].map((t) => <Tick key={`y${t}`} p={[0.3, t, 0]} text={String(t)} color={C.y} />)}
        </>
      )}
    </group>
  );
}

/** Writes the world position under the mouse (on the Y=0 plane) straight into the status bar, no React re-render. */
function CursorProbe({ target }: { target: { current: HTMLSpanElement | null } }) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ raycaster, pointer, camera }) => {
    raycaster.setFromCamera(pointer, camera);
    const el = target.current;
    if (el && raycaster.ray.intersectPlane(plane, hit))
      el.textContent = `X ${hit.x.toFixed(2)}   Y 0.00   Z ${hit.z.toFixed(2)}`;
  });
  return null;
}

/** Numpad-style view snapping + focus-on-selection. */
function ViewController({ req, getTarget }: { req: { n: number; kind: ViewKind } | null; getTarget: () => THREE.Object3D | undefined }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    if (!req || !controls) return;
    if (req.kind === "focus") {
      const o = getTarget();
      if (!o) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      const offset = camera.position.clone().sub(controls.target);
      controls.target.copy(p);
      camera.position.copy(p).add(offset);
    } else {
      const dir: V3 = { front: [0, 0, 1], right: [1, 0, 0], top: [0, 1, 0.0001], iso: [0.6, 0.5, 0.8] }[req.kind] as V3;
      const dist = camera.position.distanceTo(controls.target) || 10;
      controls.target.set(0, 0, 0);
      camera.position.set(...dir).normalize().multiplyScalar(dist);
    }
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);
  return null;
}

/* ───────────── side-panel widgets ───────────── */
function NumField({ label, color, value, step, unit, onChange }: {
  label: string; color: string; value: number; step: number; unit?: string; onChange: (n: number) => void;
}) {
  const drag = useRef<{ x: number; v: number } | null>(null);
  return (
    <div className="b3d-num">
      <span
        className="b3d-axis" style={{ background: color }} title="Drag to scrub"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, v: value }; }}
        onPointerMove={(e) => { if (drag.current) onChange(drag.current.v + (e.clientX - drag.current.x) * step * 0.25); }}
        onPointerUp={() => { drag.current = null; }}
      >{label}</span>
      <input
        type="number" step={step} value={+value.toFixed(3)} aria-label={label}
        onChange={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) onChange(n); }}
      />
      {unit && <em>{unit}</em>}
    </div>
  );
}

function VecRow({ title, v, step, onChange, mul = 1, unit }: {
  title: string; v: V3; step: number; onChange: (v: V3) => void; mul?: number; unit?: string;
}) {
  const cols = [C.x, C.y, C.z];
  return (
    <div className="b3d-group">
      <div className="b3d-gtitle">{title}</div>
      {(["X", "Y", "Z"] as const).map((ax, i) => (
        <NumField
          key={ax} label={ax} color={cols[i]} value={v[i] * mul} step={step} unit={unit}
          onChange={(n) => { const nv: V3 = [...v]; nv[i] = n / mul; onChange(nv); }}
        />
      ))}
    </div>
  );
}

function Btn({ on, children, ...rest }: { on?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={"b3d-btn" + (on ? " on" : "")} aria-pressed={on} {...rest}>{children}</button>;
}

/* ───────────── main component ───────────── */
export default function Editor3D({ height = "100vh", initialObjects, onChange }: {
  height?: string; initialObjects?: SceneObject[]; onChange?: (objects: SceneObject[]) => void;
}) {
  const [objects, setObjects] = useState<SceneObject[]>(initialObjects ?? SEED);
  const [selectedId, setSelectedId] = useState<string | null>(objects[0]?.id ?? null);
  const [tool, setTool] = useState<Tool>("translate");
  const [space, setSpace] = useState<"world" | "local">("world");
  const [snap, setSnap] = useState(false);
  const [shading, setShading] = useState<Shading>("both");
  const [ov, setOv] = useState({ grid: true, axes: true, labels: true, vertices: false, ortho: false, panel: true });
  const [view, setView] = useState<{ n: number; kind: ViewKind } | null>(null);
  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  const meshes = useRef(new Map<string, THREE.Object3D>());
  const objRef = useRef(objects); objRef.current = objects;
  const selRef = useRef(selectedId); selRef.current = selectedId;
  const cursorRef = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const hovering = useRef(false);

  const selected = objects.find((o) => o.id === selectedId) ?? null;

  useEffect(() => { onChange?.(objects); }, [objects, onChange]);
  useEffect(() => { setTarget((selectedId && meshes.current.get(selectedId)) || null); }, [selectedId, objects.length]);

  const register = useCallback((id: string, obj: THREE.Object3D | null) => {
    if (obj) meshes.current.set(id, obj); else meshes.current.delete(id);
  }, []);
  const patch = useCallback((id: string, p: Partial<SceneObject>) =>
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o))), []);
  const syncFromObject = useCallback((id: string, obj: THREE.Object3D) =>
    patch(id, {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    }), [patch]);

  const add = useCallback((kind: Kind) => {
    const o = makeObject(kind, objRef.current);
    setObjects((p) => [...p, o]); setSelectedId(o.id);
  }, []);
  const remove = useCallback(() => {
    const id = selRef.current; if (!id) return;
    setObjects((p) => p.filter((o) => o.id !== id)); setSelectedId(null);
  }, []);
  const duplicate = useCallback(() => {
    const src = objRef.current.find((o) => o.id === selRef.current); if (!src) return;
    const copy: SceneObject = {
      ...makeObject(src.kind, objRef.current), color: src.color,
      position: [src.position[0] + 0.5, src.position[1], src.position[2] + 0.5],
      rotation: [...src.rotation], scale: [...src.scale],
    };
    setObjects((p) => [...p, copy]); setSelectedId(copy.id);
  }, []);
  const requestView = useCallback((kind: ViewKind) => setView((v) => ({ n: (v?.n ?? 0) + 1, kind })), []);
  const getTarget = useCallback(() => (selRef.current ? meshes.current.get(selRef.current) : undefined), []);
  const toggle = (k: keyof typeof ov) => setOv((v) => ({ ...v, [k]: !v[k] }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hovering.current || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest?.("input,textarea,select")) return;
      const k = e.key.toLowerCase();
      if (e.shiftKey && k === "d") { duplicate(); return; }
      const map: Record<string, () => void> = {
        q: () => setTool("select"), g: () => setTool("translate"), r: () => setTool("rotate"), s: () => setTool("scale"),
        x: remove, delete: remove, backspace: remove, escape: () => setSelectedId(null), f: () => requestView("focus"),
        n: () => setOv((v) => ({ ...v, panel: !v.panel })),
        "1": () => requestView("front"), "3": () => requestView("right"), "7": () => requestView("top"), "0": () => requestView("iso"),
      };
      map[k]?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duplicate, remove, requestView]);

  const tools: [Tool, string, string][] = [["select", "Select", "Q"], ["translate", "Move", "G"], ["rotate", "Rotate", "R"], ["scale", "Scale", "S"]];

  return (
    <div className="b3d" style={{ height }} onPointerEnter={() => (hovering.current = true)} onPointerLeave={() => (hovering.current = false)}>
      <style>{CSS}</style>

      <header className="b3d-head">
        <span className="b3d-dim">Add</span>
        {(Object.keys(KINDS) as Kind[]).map((k) => <Btn key={k} onClick={() => add(k)}>{KINDS[k].label}</Btn>)}
        <i className="b3d-sep" />
        <div className="b3d-seg" role="group" aria-label="Shading">
          {(["solid", "wire", "both"] as Shading[]).map((s) => (
            <Btn key={s} on={shading === s} onClick={() => setShading(s)}>{s === "both" ? "Solid + Wire" : s === "solid" ? "Solid" : "Wire"}</Btn>
          ))}
        </div>
        <i className="b3d-sep" />
        <Btn on={ov.grid} onClick={() => toggle("grid")}>Grid</Btn>
        <Btn on={ov.axes} onClick={() => toggle("axes")}>Axes</Btn>
        <Btn on={ov.labels} onClick={() => toggle("labels")}>Numbers</Btn>
        <Btn on={ov.vertices} onClick={() => toggle("vertices")}>Vertices</Btn>
        <i className="b3d-sep" />
        <Btn onClick={() => requestView("front")} title="Front (1)">Front</Btn>
        <Btn onClick={() => requestView("right")} title="Right (3)">Right</Btn>
        <Btn onClick={() => requestView("top")} title="Top (7)">Top</Btn>
        <Btn onClick={() => requestView("iso")} title="Perspective (0)">Iso</Btn>
        <Btn on={ov.ortho} onClick={() => toggle("ortho")}>Ortho</Btn>
        <span className="b3d-grow" />
        <Btn on={ov.panel} onClick={() => toggle("panel")} title="Side panel (N)">Panel</Btn>
      </header>

      <div className="b3d-main">
        <nav className="b3d-tools" aria-label="Tools">
          {tools.map(([t, label, key]) => (
            <Btn key={t} on={tool === t} onClick={() => setTool(t)} title={`${label} (${key})`}>
              {label}<small>{key}</small>
            </Btn>
          ))}
          <i className="b3d-hsep" />
          <Btn on={space === "local"} onClick={() => setSpace((s) => (s === "world" ? "local" : "world"))} title="Gizmo orientation">
            {space === "world" ? "World" : "Local"}
          </Btn>
          <Btn on={snap} onClick={() => setSnap((s) => !s)} title="Snap: 0.25 move · 15° rotate · 0.1 scale">Snap</Btn>
        </nav>

        <div className="b3d-view">
          <Canvas
            dpr={[1, 2]}
            onPointerMissed={(e) => { if (e.button === 0 && !tcRef.current?.axis) setSelectedId(null); }}
          >
            <color attach="background" args={["#393939"]} />
            {ov.ortho
              ? <OrthographicCamera key="o" makeDefault position={[6, 5, 8]} zoom={70} near={-200} far={1000} />
              : <PerspectiveCamera key="p" makeDefault position={[6, 5, 8]} fov={40} near={0.1} far={1000} />}
            <hemisphereLight color="#ffffff" groundColor="#3a3a3a" intensity={0.8} />
            <directionalLight position={[5, 10, 7]} intensity={1.6} />
            <directionalLight position={[-6, 4, -5]} intensity={0.5} />

            {ov.grid && (
              <Grid
                position={[0, -0.001, 0]} args={[10, 10]} infiniteGrid side={THREE.DoubleSide}
                cellSize={1} cellThickness={0.6} cellColor="#4c4c4c"
                sectionSize={10} sectionThickness={1.1} sectionColor="#666666"
                fadeDistance={90} fadeStrength={1.4}
              />
            )}
            {ov.axes && <Axes labels={ov.labels} />}

            {objects.map((o) => (
              <SceneMesh
                key={o.id} o={o} selected={o.id === selectedId} shading={shading}
                vertices={ov.vertices} register={register} onSelect={setSelectedId}
              />
            ))}

            {tool !== "select" && target && selected?.visible && (
              <TransformControls
                key={selectedId} ref={tcRef} object={target} mode={tool} space={space}
                translationSnap={snap ? 0.25 : null}
                rotationSnap={snap ? THREE.MathUtils.degToRad(15) : null}
                scaleSnap={snap ? 0.1 : null}
                onObjectChange={() => selectedId && syncFromObject(selectedId, target)}
              />
            )}

            <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={0.5} maxDistance={300} />
            <GizmoHelper alignment="top-right" margin={[72, 72]}>
              <GizmoViewport axisColors={[C.x, C.y, C.z]} labelColor="#111111" />
            </GizmoHelper>
            <ViewController req={view} getTarget={getTarget} />
            <CursorProbe target={cursorRef} />
          </Canvas>
          <div className="b3d-hud">
            {ov.ortho ? "Orthographic" : "User Perspective"}<br />({objects.length}) {selected?.name ?? "Scene"}
          </div>
        </div>

        {ov.panel && (
          <aside className="b3d-side" aria-label="Scene panel">
            <section>
              <h3>Outliner</h3>
              <ul className="b3d-list">
                {objects.map((o) => (
                  <li key={o.id}>
                    <button type="button" className={"b3d-row" + (o.id === selectedId ? " on" : "")} onClick={() => setSelectedId(o.id)}>
                      <span className="b3d-chip" style={{ background: o.color }} />{o.name}
                    </button>
                    <button type="button" className="b3d-eye" onClick={() => patch(o.id, { visible: !o.visible })}>
                      {o.visible ? "Hide" : "Show"}
                    </button>
                  </li>
                ))}
                {!objects.length && <li className="b3d-dim b3d-pad">Empty scene. Use Add in the header.</li>}
              </ul>
            </section>
            <section>
              <h3>Properties</h3>
              {selected ? (
                <div className="b3d-props">
                  <input className="b3d-name" value={selected.name} aria-label="Object name" onChange={(e) => patch(selected.id, { name: e.target.value })} />
                  <VecRow title="Location" v={selected.position} step={0.1} unit="m" onChange={(position) => patch(selected.id, { position })} />
                  <VecRow title="Rotation" v={selected.rotation} step={1} mul={180 / Math.PI} unit="°" onChange={(rotation) => patch(selected.id, { rotation })} />
                  <VecRow title="Scale" v={selected.scale} step={0.05} onChange={(scale) => patch(selected.id, { scale })} />
                  <div className="b3d-group">
                    <div className="b3d-gtitle">Color</div>
                    <input type="color" value={selected.color} aria-label="Color" onChange={(e) => patch(selected.id, { color: e.target.value })} />
                  </div>
                  <div className="b3d-actions">
                    <Btn onClick={duplicate}>Duplicate</Btn>
                    <Btn onClick={remove}>Delete</Btn>
                  </div>
                </div>
              ) : <p className="b3d-dim b3d-pad">Nothing selected. Click an object in the viewport or outliner.</p>}
            </section>
          </aside>
        )}
      </div>

      <footer className="b3d-status">
        <span ref={cursorRef} className="b3d-mono">X 0.00   Y 0.00   Z 0.00</span>
        <span className="b3d-grow" />
        <span className="b3d-dim">Orbit: drag · Pan: right-drag · Zoom: wheel · G/R/S transform · X delete · ⇧D duplicate · F focus · N panel</span>
      </footer>
    </div>
  );
}

/* ───────────── styles (Blender-like dark theme, scoped under .b3d) ───────────── */
const CSS = `
.b3d{--bg:#1f1f1f;--panel:#2b2b2b;--field:#1a1a1a;--line:#0e0e0e;--text:#d6d6d6;--dim:#8d8d8d;--sel:#4772b3;--orange:#ffa028;
display:grid;grid-template-rows:auto minmax(0,1fr) 24px;background:var(--bg);color:var(--text);
font:12px/1.35 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden;width:100%}
.b3d *{box-sizing:border-box}
.b3d-head,.b3d-status{display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--panel);overflow-x:auto;white-space:nowrap}
.b3d-head{border-bottom:1px solid var(--line)}.b3d-status{border-top:1px solid var(--line);padding:0 10px}
.b3d-grow{flex:1}.b3d-dim{color:var(--dim)}.b3d-pad{padding:8px 10px}.b3d-mono{font-variant-numeric:tabular-nums;color:#bdbdbd}
.b3d-sep{width:1px;align-self:stretch;background:#454545;margin:0 4px}.b3d-hsep{height:1px;background:#454545;margin:6px 4px}
.b3d-seg{display:flex;gap:1px}.b3d-seg .b3d-btn{border-radius:0}.b3d-seg .b3d-btn:first-child{border-radius:4px 0 0 4px}.b3d-seg .b3d-btn:last-child{border-radius:0 4px 4px 0}
.b3d-btn{height:24px;padding:0 9px;border:1px solid #181818;border-radius:4px;background:#3c3c3c;color:var(--text);font:inherit;cursor:pointer}
.b3d-btn:hover{background:#4a4a4a}.b3d-btn.on{background:var(--sel);color:#fff;border-color:#2c4a7a}
.b3d button:focus-visible,.b3d input:focus-visible{outline:2px solid var(--orange);outline-offset:1px}
.b3d-main{display:grid;grid-template-columns:52px minmax(0,1fr) auto;min-height:0}
.b3d-tools{display:flex;flex-direction:column;gap:4px;padding:6px 4px;background:var(--panel);border-right:1px solid var(--line)}
.b3d-tools .b3d-btn{height:42px;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;font-size:11px}
.b3d-tools .b3d-btn small{color:inherit;opacity:.55;font-size:9px}
.b3d-view{position:relative;min-width:0;min-height:0;isolation:isolate}
.b3d-view canvas{display:block}
.b3d-hud{position:absolute;left:12px;top:10px;pointer-events:none;color:#e6e6e6;opacity:.8;font-size:12px;text-shadow:0 1px 2px #000;z-index:20}
.b3d-tick{font:10px/1 Inter,system-ui,sans-serif;opacity:.8;white-space:nowrap;text-shadow:0 1px 2px #000}
.b3d-side{width:272px;background:var(--panel);border-left:1px solid var(--line);overflow-y:auto;min-height:0}
.b3d-side h3{margin:0;padding:6px 10px;font-size:12px;font-weight:600;background:#333;border-block:1px solid var(--line)}
.b3d-list{list-style:none;margin:0;padding:4px;max-height:190px;overflow-y:auto}
.b3d-list li{display:flex;align-items:center;gap:4px}
.b3d-row{flex:1;display:flex;align-items:center;gap:8px;text-align:left;height:22px;padding:0 6px;border:0;border-radius:3px;background:transparent;color:var(--text);font:inherit;cursor:pointer}
.b3d-row:hover{background:#383838}.b3d-row.on{background:var(--sel);color:#fff}
.b3d-chip{width:9px;height:9px;border-radius:2px;border:1px solid #0006}
.b3d-eye{height:22px;border:0;background:transparent;color:var(--dim);font:inherit;font-size:11px;cursor:pointer}.b3d-eye:hover{color:var(--text)}
.b3d-props{padding:8px 10px;display:flex;flex-direction:column;gap:10px}
.b3d-name,.b3d-num input{width:100%;height:22px;padding:0 6px;background:var(--field);border:1px solid #111;border-radius:3px;color:var(--text);font:inherit}
.b3d-group{display:flex;flex-direction:column;gap:2px}.b3d-gtitle{color:var(--dim);margin-bottom:1px}
.b3d-num{display:flex;align-items:stretch}
.b3d-axis{width:22px;display:grid;place-items:center;color:#111;font-weight:700;border-radius:3px 0 0 3px;cursor:ew-resize;touch-action:none}
.b3d-num input{border-radius:0 3px 3px 0;border-left:0;font-variant-numeric:tabular-nums}
.b3d-num em{align-self:center;margin-left:6px;width:12px;font-style:normal;color:var(--dim)}
.b3d input[type=color]{width:100%;height:24px;padding:0;border:1px solid #111;border-radius:3px;background:var(--field);cursor:pointer}
.b3d-actions{display:flex;gap:6px}
@media (max-width:820px){
 .b3d-main{grid-template-columns:52px minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto}
 .b3d-side{grid-column:1/-1;width:auto;max-height:42vh;border-left:0;border-top:1px solid var(--line)}
}`;
