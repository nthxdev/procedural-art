/**
 * BlenderUI.tsx — Blender 5.x style workspace (Sculpting + Shading)
 * Deps: react, lucide-react, tailwindcss (v3.4+ or v4)
 *
 * Interactions
 *  - Drag the thin gaps between areas to resize them (col-resize / row-resize cursors)
 *  - Ctrl+Space over any area: maximize / restore it
 *  - Viewport: wheel = zoom, middle-drag = orbit, Shift+middle-drag = pan,
 *    drag the axis gizmo = orbit, drag the magnifier = zoom, drag the hand = pan
 *  - Sculpt viewport: press F, move the mouse to change brush size, click/Enter confirm, Esc cancel
 *  - Drag number fields (Size, Strength, Samples…) left/right to change them
 *  - Node editor: drag to pan.   Asset shelf: wheel scrolls horizontally
 */
import {
  createContext, Fragment, useContext, useEffect, useRef, useState,
  type CSSProperties, type PointerEvent as RPE, type ReactNode,
} from "react";
import {
  ArrowLeft, ArrowRight, ArrowUp, Box, Brush, Camera, ChevronDown, ChevronRight, Circle,
  Eraser, Eye, Folder, Globe, Hand, Image as ImageIcon, Layers, LayoutGrid, Lightbulb, Menu,
  Minus, Mountain, Move, Pencil, RefreshCw, RotateCw, Scaling, Search, Square, Video, Waves,
  Wrench, X, ZoomIn,
} from "lucide-react";

/* ───────────────────────── helpers ───────────────────────── */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Pointer drag with a forced global cursor. onMove gets (dx, dy, totalX, totalY). */
function drag(e: RPE, cursor: string, onMove: (dx: number, dy: number, tx: number, ty: number) => void) {
  e.preventDefault();
  e.stopPropagation();
  const sx = e.clientX, sy = e.clientY;
  let lx = sx, ly = sy;
  const st = document.createElement("style");
  st.textContent = `*{cursor:${cursor}!important}`;
  document.head.append(st);
  const move = (m: PointerEvent) => {
    onMove(m.clientX - lx, m.clientY - ly, m.clientX - sx, m.clientY - sy);
    lx = m.clientX; ly = m.clientY;
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    st.remove();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/** Size state + pointerdown handler for a splitter. flip = growing when dragged left/up. */
function useSize(init: number, axis: "x" | "y", min: number, max: number, flip = false) {
  const [s, set] = useState(init);
  const down = (e: RPE) => {
    const s0 = s;
    drag(e, axis === "x" ? "col-resize" : "row-resize", (_a, _b, tx, ty) =>
      set(clamp(s0 + (flip ? -1 : 1) * (axis === "x" ? tx : ty), min, max)));
  };
  return [s, down] as const;
}

function Gap({ axis, onPointerDown }: { axis: "x" | "y"; onPointerDown: (e: RPE) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={`shrink-0 touch-none transition-colors hover:bg-[#4772b3]/60 ${
        axis === "x" ? "w-[5px] cursor-col-resize" : "h-[5px] cursor-row-resize"
      }`}
    />
  );
}

/* ───────────────────────── primitives ───────────────────────── */

type Hov = { current: string };
const MaxCtx = createContext<string | null>(null);

function Area({ id, hov, className = "", style, children }: {
  id: string; hov: Hov; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  const full = useContext(MaxCtx) === id;
  return (
    <section
      onPointerEnter={() => { hov.current = id; }}
      style={full ? undefined : style}
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md bg-[#303030] ${full ? "flex-1" : className}`}
    >
      {children}
    </section>
  );
}

const Btn = ({ children, chev, on, onClick }: { children: ReactNode; chev?: boolean; on?: boolean; onClick?: () => void }) => (
  <button onClick={onClick} className={`flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 ${on ? "bg-[#4772b3] text-white" : "hover:bg-[#4b4b4b]"}`}>
    {children}{chev && <ChevronDown size={10} className="opacity-70" />}
  </button>
);

const Pill = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <button className={`flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded bg-[#545454] px-2 hover:bg-[#656565] ${className}`}>
    {children}<ChevronDown size={10} className="ml-auto opacity-70" />
  </button>
);

const SearchBox = ({ w = 130 }: { w?: number }) => (
  <div style={{ width: w }} className="flex h-[20px] shrink-0 items-center gap-1.5 rounded bg-[#1d1d1d] px-1.5 text-[#8a8a8a]">
    <Search size={11} />Search
  </div>
);

function Field({ label, value, min, max, step, dec = 0, unit = "", fill = true, onChange, className = "" }: {
  label: string; value: number; min: number; max: number; step: number; dec?: number;
  unit?: string; fill?: boolean; onChange: (v: number) => void; className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      onPointerDown={(e) => {
        const v0 = value;
        drag(e, "ew-resize", (_x, _y, tx) => onChange(clamp(+(v0 + tx * step).toFixed(3), min, max)));
      }}
      className={`relative flex h-[22px] shrink-0 cursor-ew-resize items-center overflow-hidden rounded px-2 ${fill ? "bg-[#1d1d1d]" : "bg-[#545454]"} ${label ? "justify-between" : "justify-center"} ${className}`}
    >
      {fill && <div className="absolute inset-y-0 left-0 bg-[#4772b3]" style={{ width: `${pct}%` }} />}
      <span className="relative">{label}</span>
      <span className="relative">{value.toFixed(dec)}{unit}</span>
    </div>
  );
}

const Check = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
  <label className="flex cursor-pointer items-center gap-2">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-[#4772b3]" />
    {label}
  </label>
);

const Row = ({ label, children }: { label?: string; children: ReactNode }) => (
  <div className="flex items-center gap-3">
    <span className="w-[38%] shrink-0 text-right text-[#b5b5b5]">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);

function Panel({ title, open: init = false, check, nested, children }: {
  title: string; open?: boolean; check?: boolean; nested?: boolean; children?: ReactNode;
}) {
  const [open, setOpen] = useState(init);
  const [on, setOn] = useState(!!check);
  return (
    <div className={`rounded ${nested ? "" : "bg-[#3a3a3a]"}`}>
      <div onClick={() => setOpen(!open)} className="flex h-6 cursor-pointer items-center gap-1.5 px-1.5 hover:bg-white/5">
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {check !== undefined && (
          <input type="checkbox" checked={on} onClick={(e) => e.stopPropagation()} onChange={(e) => setOn(e.target.checked)} className="accent-[#4772b3]" />
        )}
        {title}
      </div>
      {open && <div className="space-y-1.5 px-2 pb-2 pt-1">{children}</div>}
    </div>
  );
}

function Shade({ init }: { init: number }) {
  const [s, setS] = useState(init);
  return (
    <div className="mx-1 flex shrink-0 rounded bg-[#1d1d1d] p-px">
      {[0, 1, 2, 3].map((i) => (
        <button key={i} onClick={() => setS(i)} className={`grid h-5 w-5 place-items-center rounded ${s === i ? "bg-[#4772b3]" : "hover:bg-[#444]"}`}>
          <Circle size={11} fill={i > 1 ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

const Logo = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <path d="M3 15h7l-4-6 4-2 3 4 3-4 5 3-4 5 3 2-9 6z" fill="#ea7600" />
    <circle cx="13" cy="14" r="3.6" fill="#265787" stroke="#fff" strokeWidth="1.5" />
  </svg>
);

/* ───────────────────────── 3D viewport ───────────────────────── */

function Gizmo({ yaw, pitch, onOrbit }: { yaw: number; pitch: number; onOrbit: (dx: number, dy: number) => void }) {
  const axes = [["X", "#e5484d", [1, 0, 0]], ["Y", "#86b82e", [0, 1, 0]], ["Z", "#3d7fe0", [0, 0, 1]]] as const;
  const pts = axes.flatMap(([n, c, v]) => [1, -1].map((s) => {
    const x = v[0] * s, y = v[1] * s, z = v[2] * s;
    const x1 = x * Math.cos(yaw) - y * Math.sin(yaw);
    const y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
    return { n, c, pos: s > 0, sx: x1, sy: -(y1 * Math.sin(pitch) + z * Math.cos(pitch)), d: y1 * Math.cos(pitch) - z * Math.sin(pitch) };
  })).sort((a, b) => b.d - a.d);
  return (
    <svg width="84" height="84" viewBox="-42 -42 84 84" className="cursor-grab" onPointerDown={(e) => drag(e, "grabbing", onOrbit)}>
      <circle r="40" fill="#fff" opacity=".06" />
      {pts.map((p) => (
        <g key={p.n + p.pos}>
          {p.pos && <line x2={p.sx * 22} y2={p.sy * 22} stroke={p.c} strokeWidth="2" />}
          <circle cx={p.sx * 22} cy={p.sy * 22} r={p.pos ? 8 : 6} fill={p.pos ? p.c : "#2a2a2a"} stroke={p.c} strokeWidth="1.2" opacity={p.pos ? 1 : 0.7} />
          {p.pos && <text x={p.sx * 22} y={p.sy * 22 + 3.5} fontSize="10" fontWeight="700" textAnchor="middle" fill="#111">{p.n}</text>}
        </g>
      ))}
    </svg>
  );
}

function Viewport3D({ id, hov, material, size, setSize, children }: {
  id: string; hov: Hov; material?: boolean; size: number; setSize: (n: number) => void; children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ yaw: 0.6, pitch: 0.45, zoom: 1, x: 0, y: 0 });
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [sizingOn, setSizingOn] = useState(false);
  const sizing = useRef<{ x: number; s: number } | null>(null);
  const mp = useRef({ x: 0, y: 0 });

  const orbit = (dx: number, dy: number) => setV((o) => ({ ...o, yaw: o.yaw + dx * 0.01, pitch: clamp(o.pitch + dy * 0.01, -1.5, 1.5) }));
  const pan = (dx: number, dy: number) => setV((o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
  const zoom = (d: number) => setV((o) => ({ ...o, zoom: clamp(o.zoom * Math.exp(d), 0.2, 6) }));

  // F = brush size mode (sculpt only)
  useEffect(() => {
    if (material) return;
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && !e.ctrlKey && hov.current === id && !sizing.current) {
        sizing.current = { x: mp.current.x, s: size }; setSizingOn(true);
      } else if (e.key === "Escape" && sizing.current) {
        setSize(sizing.current.s); sizing.current = null; setSizingOn(false);
      } else if (e.key === "Enter" && sizing.current) {
        sizing.current = null; setSizingOn(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [material, size, hov, id, setSize]);

  const move = (e: RPE) => {
    const r = ref.current!.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    mp.current = p; setMouse(p);
    if (sizing.current) setSize(clamp(Math.round(sizing.current.s + (p.x - sizing.current.x) * 2), 5, 500));
  };
  const down = (e: RPE) => {
    if (sizing.current) { sizing.current = null; setSizingOn(false); return; }
    const shift = e.shiftKey;
    if (e.button === 1 || (e.button === 0 && e.altKey)) drag(e, "grabbing", (dx, dy) => (shift ? pan(dx, dy) : orbit(dx, dy)));
  };

  const D = 440 * v.zoom;
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerDown={down}
      onPointerLeave={() => setMouse(null)}
      onWheel={(e) => zoom(-e.deltaY * 0.001)}
      className={`relative min-h-0 flex-1 touch-none overflow-hidden ${material ? "cursor-default bg-[linear-gradient(#8d8379,#6e6b67_60%,#5b5956)]" : "cursor-none bg-[#3d3d3d]"}`}
    >
      {/* sphere */}
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: D, height: D,
          transform: `translate(calc(-50% + ${v.x}px), calc(-50% + ${v.y}px))`,
          background: material
            ? "radial-gradient(circle at 50% 40%, #dfe3e7, #c5cacf 60%, #a9afb5)"
            : "radial-gradient(circle at 50% 45%, #bcbebe 0%, #9fa2a1 45%, #6f7271 80%, #55504f 100%)",
          boxShadow: material ? "0 0 0 2px #f5a02e" : undefined,
        }}
      />

      {/* overlay text */}
      <div className={`pointer-events-none absolute top-2 leading-[17px] ${material ? "left-2.5" : "left-[56px]"}`}>
        <div>User Perspective</div>
        <div>{material ? "(1) Collection | Quad Sphere" : "(1) Quad Sphere | Quad Sphere"}</div>
        {!material && (
          <table className="mt-2 text-[#cfcfcf]"><tbody>
            <tr><td className="pr-5">Vertices</td><td>24,578</td></tr>
            <tr><td>Faces</td><td>24,576</td></tr>
          </tbody></table>
        )}
      </div>

      {/* HDRI preview balls */}
      {material && (
        <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-center gap-1">
          <div className="flex gap-2">
            <div className="h-[96px] w-[96px] rounded-full bg-[radial-gradient(circle_at_40%_35%,#9aa4ae,#6e7881_60%,#4b535b)]" />
            <div className="h-[96px] w-[96px] rounded-full bg-[radial-gradient(circle_at_50%_30%,#cfe3ff,#5f7d4d_55%,#3d3a2e)] ring-1 ring-black/40" />
          </div>
        </div>
      )}

      {/* navigation gizmo + buttons */}
      <div className="absolute right-3 top-2 flex flex-col items-center gap-2">
        <Gizmo yaw={v.yaw} pitch={v.pitch} onOrbit={orbit} />
        {[
          { I: ZoomIn, cur: "ns-resize", fn: (_dx: number, dy: number) => zoom(-dy * 0.01) },
          { I: Hand, cur: "grabbing", fn: pan },
          { I: Video, cur: "", fn: null },
          { I: LayoutGrid, cur: "", fn: null },
        ].map(({ I, cur, fn }, i) => (
          <button
            key={i}
            onPointerDown={(e) => fn && drag(e, cur, fn)}
            className={`grid h-[26px] w-[26px] place-items-center rounded-full bg-[#262626]/80 hover:bg-[#444] ${fn ? (i === 0 ? "cursor-ns-resize" : "cursor-grab") : ""}`}
          >
            <I size={14} />
          </button>
        ))}
      </div>

      {children}

      {/* brush cursor */}
      {!material && mouse && (
        <div
          className="pointer-events-none absolute rounded-full border border-[#4a90e2]"
          style={{ width: size, height: size, left: mouse.x - size / 2, top: mouse.y - size / 2 }}
        >
          <div className="absolute rounded-full border border-[#4a90e2]/70" style={{ inset: size * 0.32 }} />
          {sizingOn && <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1">{size} px</span>}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── sculpt-specific ───────────────────────── */

const TOOLS = [Brush, Waves, Mountain, Circle, Eraser, Move, RotateCw, Scaling, Pencil];

function Toolbar() {
  const [t, setT] = useState(0);
  return (
    <div className="absolute left-1.5 top-1.5 flex w-[40px] cursor-default flex-col gap-1 rounded bg-[#282828]/90 p-[4px]">
      {TOOLS.map((I, i) => (
        <Fragment key={i}>
          {i === 5 && <div className="my-0.5 h-px bg-[#444]" />}
          <button onClick={() => setT(i)} className={`grid h-[32px] w-[32px] place-items-center rounded ${t === i ? "bg-[#4772b3] text-white" : "hover:bg-[#444]"}`}>
            <I size={18} />
          </button>
        </Fragment>
      ))}
    </div>
  );
}

const BRUSHES: [string, typeof Brush][] = [
  ["Draw", Brush], ["Draw Sharp", Pencil], ["Clay", Mountain], ["Clay Strips", Layers],
  ["Smooth", Waves], ["Grab", Move], ["Crease", Eraser], ["Inflate", Circle],
  ["Flatten", Minus], ["Pinch", Scaling], ["Mask", Square], ["Snake Hook", Hand],
];

function Shelf({ height, brush, setBrush }: { height: number; brush: string; setBrush: (b: string) => void }) {
  const [tab, setTab] = useState("All");
  return (
    <div style={{ height }} className="flex shrink-0 flex-col bg-[#303030]">
      <div className="flex h-[26px] shrink-0 items-center gap-3 px-2">
        <Menu size={14} />
        {["All", "General", "Paint", "Simulation"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-full border-b-2 px-1 ${tab === t ? "border-[#4772b3] text-white" : "border-transparent text-[#a0a0a0]"}`}>{t}</button>
        ))}
        <div className="flex-1" />
        <Pill><LayoutGrid size={12} /></Pill>
        <SearchBox w={160} />
      </div>
      <div
        onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}
        className="flex min-h-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden bg-[#222] p-1"
      >
        {BRUSHES.map(([n, I]) => (
          <button
            key={n}
            onClick={() => setBrush(n)}
            className={`flex w-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded ${brush === n ? "bg-[#464e5e] ring-1 ring-[#4772b3]" : "bg-[#2e2e2e] hover:bg-[#3d3d3d]"}`}
          >
            <I size={18} /><span className="max-w-full truncate px-1">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SculptHeaders({ brush, size, setSize, strength, setStrength }: {
  brush: string; size: number; setSize: (n: number) => void; strength: number; setStrength: (n: number) => void;
}) {
  const [sym, setSym] = useState([false, false, false]);
  const [dyn, setDyn] = useState(false);
  return (
    <>
      <div className="flex h-[26px] shrink-0 items-center gap-0.5 overflow-hidden px-1.5">
        <Btn chev><Box size={13} /></Btn>
        <Pill><Brush size={12} />Sculpt Mode</Pill>
        {["View", "Sculpt", "Mask", "Face Sets"].map((m) => <Btn key={m}>{m}</Btn>)}
        <div className="flex-1" />
        <Btn chev><Eye size={13} /></Btn>
        <Shade init={1} />
      </div>
      <div className="flex h-[26px] shrink-0 items-center gap-1 overflow-hidden px-1.5">
        <Pill className="w-[110px]"><Brush size={12} />{brush}</Pill>
        <Field label="Size" value={size} min={1} max={500} step={1} unit=" px" onChange={setSize} className="w-[150px]" />
        <Field label="Strength" value={strength} min={0} max={1} step={0.005} dec={3} onChange={setStrength} className="w-[170px]" />
        {["Brush", "Texture", "Stroke", "Falloff", "Cursor"].map((m) => <Btn key={m} chev>{m}</Btn>)}
        <div className="flex-1" />
        <div className="flex gap-px">
          {["X", "Y", "Z"].map((a, i) => (
            <button key={a} onClick={() => setSym(sym.map((s, j) => (j === i ? !s : s)))} className={`h-[22px] w-[20px] rounded ${sym[i] ? "bg-[#4772b3]" : "bg-[#545454] hover:bg-[#656565]"}`}>{a}</button>
          ))}
        </div>
        <Check on={dyn} set={setDyn} label="Dyntopo" />
        <Btn chev>Remesh</Btn>
        <Btn chev>Options</Btn>
      </div>
    </>
  );
}

/* ───────────────────────── side editors ───────────────────────── */

function Outliner() {
  const [sel, setSel] = useState("Quad Sphere");
  const rows: [string, number, ReactNode, boolean][] = [
    ["Scene Collection", 0, <Box size={12} />, false],
    ["Collection", 1, <Box size={12} className="text-[#cfcfcf]" />, true],
    ["Camera", 2, <Video size={12} className="text-[#e8a13a]" />, true],
    ["Light", 2, <Lightbulb size={12} className="text-[#e8a13a]" />, true],
    ["Quad Sphere", 2, <Circle size={12} className="text-[#e8a13a]" />, true],
  ];
  return (
    <>
      <div className="flex h-[26px] shrink-0 items-center gap-1 px-1.5">
        <Btn chev><LayoutGrid size={13} /></Btn>
        <SearchBox />
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#282828] py-0.5">
        {rows.map(([n, d, ic, vis]) => (
          <div
            key={n}
            onClick={() => setSel(n)}
            style={{ paddingLeft: 8 + d * 14 }}
            className={`flex h-5 cursor-pointer items-center gap-1.5 pr-2 ${sel === n ? "bg-[#334e77]" : "hover:bg-white/5"}`}
          >
            <ChevronRight size={11} className="opacity-60" />{ic}
            <span className={sel === "Quad Sphere" && n === "Quad Sphere" ? "text-[#ffaf29]" : ""}>{n}</span>
            <div className="flex-1" />
            {vis && <><Eye size={12} /><Camera size={12} /></>}
          </div>
        ))}
      </div>
    </>
  );
}

const PROP_TABS = [
  [Wrench, "#9aa0a6", "Tool"], [Camera, "#e8a13a", "Render"], [ImageIcon, "#9aa0a6", "Output"],
  [Layers, "#9aa0a6", "View Layer"], [Globe, "#d9534f", "World"], [Box, "#e8a13a", "Object"],
] as const;

function Properties() {
  const [tab, setTab] = useState(1);
  const [vs, setVs] = useState(16);
  const [rs, setRs] = useState(64);
  const [tr, setTr] = useState(true);
  const [js, setJs] = useState(false);
  const rest: [string, boolean?][] = [
    ["Light Paths"], ["Raytracing", false], ["Volumes"], ["Curves"], ["Simplify", false], ["Depth of Field"],
    ["Motion Blur", false], ["Film"], ["Performance"], ["Grease Pencil"], ["Freestyle", false], ["Color Management"],
  ];
  return (
    <>
      <div className="flex h-[26px] shrink-0 items-center gap-1 px-1.5">
        <Btn chev><Wrench size={13} /></Btn>
        <SearchBox w={140} />
        <div className="flex-1" />
        <Btn chev>{" "}</Btn>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[32px] shrink-0 flex-col items-center gap-1 bg-[#282828] py-1.5">
          {PROP_TABS.map(([I, c, t], i) => (
            <button key={t} title={t} onClick={() => setTab(i)} className={`grid h-6 w-6 place-items-center rounded ${tab === i ? "bg-[#4772b3]/70" : "hover:bg-[#444]"}`}>
              <I size={14} color={c} />
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-1 overflow-y-auto bg-[#303030] p-2">
          {tab !== 1 ? (
            <p className="p-2 text-[#8a8a8a]">{PROP_TABS[tab][2]} properties</p>
          ) : (
            <>
              <div className="flex h-6 items-center gap-2 text-[#cfcfcf]"><Globe size={13} />Scene</div>
              <Row label="Render Engine"><Pill className="w-full">EEVEE</Pill></Row>
              <Panel title="Sampling" open>
                <Panel title="Viewport" open nested>
                  <Row label="Samples"><Field label="" value={vs} min={1} max={64} step={0.5} fill={false} onChange={(n) => setVs(Math.round(n))} /></Row>
                  <Row><Check on={tr} set={setTr} label="Temporal Reprojection" /></Row>
                  <Row><Check on={js} set={setJs} label="Jittered Shadows" /></Row>
                </Panel>
                <Panel title="Render" open nested>
                  <Row label="Samples"><Field label="" value={rs} min={1} max={512} step={1} fill={false} onChange={(n) => setRs(Math.round(n))} /></Row>
                </Panel>
                <Panel title="Shadows" check nested />
                <Panel title="Advanced" nested />
              </Panel>
              {rest.map(([t, c]) => <Panel key={t} title={t} check={c} />)}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── shading-workspace editors ───────────────────────── */

const FOLDERS = ["atlas-of-possi…tures", "Blackmagic Design", "blender", "Camera Roll", "choosen", "codex-ui-analysis", "docs", "figma", "generative-art-concepts", "Glaze", "keyboard", "nthx_obs"];

function FileBrowser() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <div className="flex h-[26px] shrink-0 items-center gap-0.5 px-1.5">
        <Btn chev><Folder size={13} /></Btn><Btn>View</Btn><Btn>Select</Btn>
      </div>
      <div className="flex h-8 shrink-0 items-center gap-1 px-1.5">
        {[ArrowLeft, ArrowRight, ArrowUp, RefreshCw].map((I, i) => (
          <button key={i} className="grid h-[22px] w-[22px] place-items-center rounded bg-[#545454] hover:bg-[#656565]"><I size={12} /></button>
        ))}
        <div className="h-[22px] min-w-0 flex-1 truncate rounded bg-[#1d1d1d] px-2 leading-[22px]">C:\Users\you\Documents\</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1 overflow-y-auto bg-[#282828] p-2">
        {FOLDERS.map((f) => (
          <button key={f} onClick={() => setSel(f)} className={`flex flex-col items-center gap-1 rounded p-2 text-center ${sel === f ? "bg-[#4772b3]" : "hover:bg-white/5"}`}>
            <Folder size={46} strokeWidth={1.2} className="fill-[#d9a441] text-[#d9a441]" />
            <span className="line-clamp-2 break-all leading-tight">{f}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function ImageEditor() {
  const [ss, setSs] = useState(1);
  return (
    <>
      <div className="flex h-[26px] shrink-0 items-center gap-0.5 px-1.5">
        <Btn chev><ImageIcon size={13} /></Btn><Btn>View</Btn>
        <div className="flex-1" />
        <Btn>+ New</Btn><Btn>Open</Btn>
      </div>
      <div className="flex h-8 shrink-0 items-center px-2">
        <Field label="Sample Size" value={ss} min={1} max={101} step={0.5} unit=" px" fill={false} onChange={(n) => setSs(Math.round(n))} className="w-[150px]" />
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#1d1d1d]">
        <div
          className="absolute inset-4 border border-[#555]"
          style={{ backgroundImage: "linear-gradient(#3a3a3a 1px,transparent 1px),linear-gradient(90deg,#3a3a3a 1px,transparent 1px)", backgroundSize: "32px 32px" }}
        />
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          <button className="grid h-6 w-6 place-items-center rounded-full bg-[#262626]/80"><ZoomIn size={13} /></button>
          <button className="grid h-6 w-6 cursor-grab place-items-center rounded-full bg-[#262626]/80"><Hand size={13} /></button>
        </div>
      </div>
    </>
  );
}

function NodeEditor() {
  const [p, setP] = useState({ x: 0, y: 0 });
  const fields: [string, number][] = [["Metallic", 0], ["Roughness", 0.5], ["IOR", 1.5], ["Alpha", 1]];
  const groups = ["Diffuse", "Subsurface", "Specular", "Transmission", "Coat", "Sheen", "Emission", "Thin Film"];
  return (
    <>
      <div className="flex h-[26px] shrink-0 items-center gap-0.5 overflow-hidden px-1.5">
        <Btn chev><LayoutGrid size={13} /></Btn>
        <Pill>Object</Pill>
        {["View", "Select", "Add", "Node"].map((m) => <Btn key={m}>{m}</Btn>)}
        <div className="flex-1" />
        <Pill className="w-[80px]">Slot 1</Pill>
        <div className="ml-1 h-[22px] w-[130px] rounded bg-[#545454] px-2 leading-[22px]">Material</div>
      </div>
      <div className="flex h-7 shrink-0 items-center gap-2 px-3 text-[#b5b5b5]">
        <Box size={12} />Quad Sphere<ChevronRight size={10} />Quad Sphere<ChevronRight size={10} />Material
      </div>
      <div
        onPointerDown={(e) => drag(e, "grabbing", (dx, dy) => setP((o) => ({ x: o.x + dx, y: o.y + dy })))}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-[#1e1e1e] [background-image:radial-gradient(#2e2e2e_1px,transparent_1px)] [background-size:20px_20px]"
      >
        <div className="absolute left-[calc(50%-190px)] top-[calc(50%-110px)]" style={{ transform: `translate(${p.x}px,${p.y}px)` }}>
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            <path d="M170 26 C 220 26, 220 48, 270 48" stroke="#8fc08f" strokeWidth="2" fill="none" />
          </svg>

          {/* Principled BSDF */}
          <div className="absolute left-0 top-0 w-[170px] rounded-md bg-[#303030] pb-1 text-[8px] outline outline-1 outline-white">
            <div className="h-[18px] rounded-t-md bg-[#2f6a2f] px-2 leading-[18px]">Principled BSDF</div>
            <div className="relative h-4 pr-2 text-right leading-4">BSDF<i className="absolute -right-[4px] top-1 h-2 w-2 rounded-full bg-[#63c763]" /></div>
            <div className="mx-2 my-px flex h-[14px] items-center justify-between"><span>Base Color</span></div>
            <div className="mx-2 mb-1 h-[14px] rounded-sm bg-white" />
            {fields.map(([n, v]) => (
              <div key={n} className="relative mx-2 my-px flex h-[14px] items-center justify-between overflow-hidden rounded-sm bg-[#3d3d3d] px-1.5">
                <div className="absolute inset-y-0 left-0 bg-[#4772b3]" style={{ width: n === "IOR" ? 0 : `${v * 100}%` }} />
                <span className="relative">{n}</span><span className="relative">{v.toFixed(3)}</span>
              </div>
            ))}
            <div className="px-2 pt-1 leading-[14px]">Normal</div>
            {groups.map((g) => <div key={g} className="px-3 leading-[13px] text-[#cfcfcf]">▸ {g}</div>)}
          </div>

          {/* Material Output */}
          <div className="absolute left-[270px] top-0 w-[100px] rounded-md bg-[#303030] pb-1 text-[8px] outline outline-1 outline-[#c0392b]">
            <div className="h-[18px] rounded-t-md bg-[#7a2a2a] px-2 leading-[18px]">Material Output</div>
            <div className="mx-2 my-[3px] flex h-4 items-center rounded-sm bg-[#545454] px-1.5">All</div>
            {["Surface", "Volume", "Displacement", "Thickness"].map((s) => (
              <div key={s} className="relative h-4 px-2 leading-4">{s}<i className="absolute -left-[4px] top-1 h-2 w-2 rounded-full bg-[#63c763]" /></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── app shell ───────────────────────── */

const Key = ({ k, children }: { k: string; children: ReactNode }) => (
  <span className="flex items-center gap-1.5">
    <kbd className="rounded bg-[#3a3a3a] px-1.5 text-[9px] text-[#bbb]">{k}</kbd>{children}
  </span>
);

export default function Viewport() {
  const hov = useRef("");
  const [ws, setWs] = useState<"Sculpting" | "Shading">("Sculpting");
  const [max, setMax] = useState<string | null>(null);
  const [brush, setBrush] = useState("Draw");
  const [size, setSize] = useState(100);
  const [strength, setStrength] = useState(0.5);

  const [rightW, rightDown] = useSize(330, "x", 220, 640, true);
  const [outH, outDown] = useSize(130, "y", 60, 500);
  const [shelfH, shelfDown] = useSize(104, "y", 26, 320, true);
  const [leftW, leftDown] = useSize(290, "x", 170, 600);
  const [imgH, imgDown] = useSize(360, "y", 90, 700, true);
  const [nodeH, nodeDown] = useSize(400, "y", 110, 700, true);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        setMax((m) => (m ? null : hov.current || null));
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const A = (id: string, children: ReactNode, className = "", style?: CSSProperties) => (
    <Area id={id} hov={hov} className={className} style={style}>{children}</Area>
  );

  const areas: Record<string, ReactNode> = {
    outliner: A("outliner", <Outliner />, "shrink-0", { height: outH }),
    properties: A("properties", <Properties />, "flex-1"),
    files: A("files", <FileBrowser />, "flex-1"),
    image: A("image", <ImageEditor />, "shrink-0", { height: imgH }),
    nodes: A("nodes", <NodeEditor />, "shrink-0", { height: nodeH }),
    viewport:
      ws === "Sculpting"
        ? A("viewport", (
          <>
            <SculptHeaders brush={brush} size={size} setSize={setSize} strength={strength} setStrength={setStrength} />
            <Viewport3D id="viewport" hov={hov} size={size} setSize={setSize}><Toolbar /></Viewport3D>
            <Gap axis="y" onPointerDown={shelfDown} />
            <Shelf height={shelfH} brush={brush} setBrush={setBrush} />
          </>
        ), "flex-1")
        : A("viewport", (
          <>
            <div className="flex h-[26px] shrink-0 items-center gap-0.5 overflow-hidden px-1.5">
              <Btn chev><Box size={13} /></Btn>
              <Pill><Square size={12} />Object Mode</Pill>
              {["View", "Select", "Add", "Object"].map((m) => <Btn key={m}>{m}</Btn>)}
              <div className="flex-1" />
              <Pill className="w-[90px]">Global</Pill>
              <Shade init={2} />
            </div>
            <Viewport3D id="viewport" hov={hov} material size={size} setSize={setSize}>
              <div className="absolute left-2 top-14 flex gap-px">
                {[Square, Square, Square, Square, Square].map((I, i) => (
                  <button key={i} className={`grid h-[22px] w-[22px] place-items-center ${i === 0 ? "bg-[#4772b3]" : "bg-[#303030]/80 hover:bg-[#4b4b4b]"}`}><I size={11} /></button>
                ))}
              </div>
            </Viewport3D>
          </>
        ), "flex-1"),
  };

  const rightCol = (
    <div style={{ width: rightW }} className="flex shrink-0 flex-col">
      {areas.outliner}
      <Gap axis="y" onPointerDown={outDown} />
      {areas.properties}
    </div>
  );

  const layout =
    ws === "Sculpting" ? (
      <>
        {areas.viewport}
        <Gap axis="x" onPointerDown={rightDown} />
        {rightCol}
      </>
    ) : (
      <>
        <div style={{ width: leftW }} className="flex shrink-0 flex-col">
          {areas.files}
          <Gap axis="y" onPointerDown={imgDown} />
          {areas.image}
        </div>
        <Gap axis="x" onPointerDown={leftDown} />
        <div className="flex min-w-0 flex-1 flex-col">
          {areas.viewport}
          <Gap axis="y" onPointerDown={nodeDown} />
          {areas.nodes}
        </div>
        <Gap axis="x" onPointerDown={rightDown} />
        {rightCol}
      </>
    );

  return (
    <MaxCtx.Provider value={max}>
      <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-[#181818] font-['Inter',system-ui,sans-serif] text-[11px] text-[#d9d9d9]">
        {/* OS title bar */}
        <div className="flex h-6 shrink-0 items-center bg-[#0f0f0f] px-2 text-[12px]">
          <Logo s={14} /><span className="ml-2">(Unsaved) - Blender 5.1.2</span>
          <div className="flex-1" />
          <Minus size={14} className="mx-3" /><Square size={11} className="mr-3" /><X size={14} />
        </div>

        {/* top bar: menus + workspaces */}
        <div className="flex h-[28px] shrink-0 items-center gap-0.5 px-2">
          <Logo />
          {["File", "Edit", "Render", "Window", "Help"].map((m) => <Btn key={m}>{m}</Btn>)}
          <div className="mx-2 h-4 w-px bg-[#444]" />
          {(["Sculpting", "Shading"] as const).map((w) => (
            <button
              key={w}
              onClick={() => { setWs(w); setMax(null); }}
              className={`h-[24px] rounded-t px-3 ${ws === w ? "bg-[#303030] text-white" : "text-[#9a9a9a] hover:text-white"}`}
            >{w}</button>
          ))}
          <button className="px-2 text-[#9a9a9a] hover:text-white">+</button>
          <div className="flex-1" />
          <Pill className="w-[120px]">Scene</Pill>
          <Pill className="w-[120px]">ViewLayer</Pill>
        </div>

        <main className="flex min-h-0 flex-1 px-[3px] pb-[3px]">{max ? areas[max] : layout}</main>

        {/* status bar */}
        <div className="flex h-[22px] shrink-0 items-center gap-5 px-2 text-[#9a9a9a]">
          <Key k="LMB">Sculpt / Select</Key>
          <Key k="MMB">Rotate View</Key>
          <Key k="F">Brush Size</Key>
          <Key k="Ctrl+Space">Maximize Area</Key>
          <div className="flex-1" />
          <span>5.1.2</span>
        </div>
      </div>
    </MaxCtx.Provider>
  );
}
