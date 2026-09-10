import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ================================================================== */
/*  tokens                                                             */
/* ================================================================== */

const INK = "#0D0D11";
const PAPER = "#F4F1E8";
const STORAGE_KEY = "panelcount:state:v2";

const SWATCHES = [
  "#7FE03C", "#A855F7", "#F472B6", "#38BDF8", "#FB923C",
  "#FACC15", "#F43F5E", "#2DD4BF", "#818CF8", "#84CC16",
];

const GRADIENT_PRESETS = [
  { id: "toxic", name: "Toxic", from: "#F4F1E8", to: "#7FE03C", angle: 168 },
  { id: "bruise", name: "Bruise", from: "#F4F1E8", to: "#A855F7", angle: 168 },
  { id: "bubblegum", name: "Bubblegum", from: "#FDE7F3", to: "#F472B6", angle: 168 },
  { id: "vapor", name: "Vapor", from: "#38BDF8", to: "#F472B6", angle: 140 },
  { id: "sunset", name: "Sunset", from: "#FACC15", to: "#F43F5E", angle: 155 },
  { id: "ultra", name: "Ultra", from: "#A855F7", to: "#38BDF8", angle: 120 },
  { id: "midnight", name: "Midnight", from: "#818CF8", to: "#0D0D11", angle: 175 },
  { id: "rust", name: "Rust", from: "#FDE7C7", to: "#FB923C", angle: 168 },
  { id: "mint", name: "Mint", from: "#F4F1E8", to: "#2DD4BF", angle: 168 },
  { id: "static", name: "Static", from: "#94A3B8", to: "#0D0D11", angle: 200 },
];

const FRAMES = [
  { id: "none", name: "None" },
  { id: "ring", name: "Double ring" },
  { id: "glow", name: "Glow" },
  { id: "spin", name: "Spinning dash" },
  { id: "tape", name: "Taped" },
  { id: "spikes", name: "Spikes" },
];

const EFFECTS = [
  { id: "none", name: "None" },
  { id: "sparks", name: "Sparks" },
  { id: "drift", name: "Drift" },
  { id: "scan", name: "Scanlines" },
  { id: "speed", name: "Speed lines" },
  { id: "glitch", name: "Glitch" },
];

const NAME_STYLES = [
  { id: "block", name: "Block" },
  { id: "gradient", name: "Gradient" },
  { id: "outline", name: "Outline" },
  { id: "sticker", name: "Sticker" },
];

const CHART_TYPES = [
  { id: "pie", label: "Pie" },
  { id: "donut", label: "Donut" },
  { id: "treemap", label: "Disk map" },
  { id: "bar", label: "Bars" },
  { id: "rings", label: "Rings" },
  { id: "radar", label: "Radar" },
];

const TRANSITIONS = [
  { id: "split", label: "Split panels", hint: "Everyone visible at once. Click a panel to give it more room." },
  { id: "carousel", label: "Torn cut", hint: "One at a time. A jagged rip wipes across on every change." },
  { id: "slide", label: "Slide", hint: "One at a time, sliding sideways like turning a page." },
  { id: "flip", label: "Impact", hint: "One at a time, slamming in with a scale and tilt." },
];

const RESET_MODES = [
  { id: "never", label: "Never" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "custom", label: "Every N days" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ================================================================== */
/*  color helpers                                                      */
/* ================================================================== */

function toRgb(hex) {
  const h = (hex || "#000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function inkOrPaper(person) {
  if (person.textMode === "light") return PAPER;
  if (person.textMode === "dark") return INK;
  const mid = mix(person.theme.from, person.theme.to, 0.6);
  return luminance(mid) > 0.42 ? INK : PAPER;
}
function gradientCss(theme, alpha) {
  const a = alpha === undefined ? 1 : alpha;
  return `linear-gradient(${theme.angle}deg, ${rgba(theme.from, a)} 0%, ${rgba(theme.to, a)} 100%)`;
}

/* ================================================================== */
/*  state                                                              */
/* ================================================================== */

const uid = () => Math.random().toString(36).slice(2, 10);

function makePerson(sectionId, name, preset) {
  const g = preset || GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)];
  return {
    id: uid(),
    sectionId,
    name,
    theme: { from: g.from, to: g.to, angle: g.angle },
    textMode: "auto",
    photo: null,
    banner: null,
    frame: "none",
    effect: "none",
    nameStyle: "block",
    bio: "",
    badges: "",
    count: 0,
    allTime: 0,
    lastTouch: null,
    base: { count: 0, allTime: 0, since: 0, touch: 0 },
    updatedAt: Date.now(),
  };
}

/* a new install starts blank. the pages are yours to name, not mine to guess */
function defaultState() {
  const stamp = Date.now();
  return {
    version: 3,
    deviceId: uid(),
    events: [],
    tombs: [],
    sections: [],
    people: [],
    settings: {
      transition: "split",
      chart: "pie",
      chartSource: "period",
      chartScope: "section",
      resetMode: "weekly",
      resetWeekday: 0,
      resetDay: 1,
      customDays: 14,
      lastReset: new Date().toISOString(),
      halftone: true,
      motion: true,
      photoBackdrop: true,
      showBios: true,
      updatedAt: stamp,
    },
    history: [],
  };
}

/* migrate v1 records so nothing is lost */
function migrate(s) {
  if (!s || !s.people) return defaultState();
  const stamp = Date.now();
  const people = s.people.map((p) => ({
    ...makePerson(p.sectionId, p.name),
    ...p,
    base: p.base || {
      count: p.count || 0,
      allTime: p.allTime || 0,
      since: s.settings?.lastReset ? new Date(s.settings.lastReset).getTime() : 0,
      touch: p.lastTouch ? new Date(p.lastTouch).getTime() : 0,
    },
    updatedAt: p.updatedAt || stamp,
    theme: p.theme || { from: PAPER, to: p.color || "#7FE03C", angle: 168 },
    banner: p.banner !== undefined ? p.banner : p.bgPhoto || null,
    textMode: p.textMode || "auto",
    frame: p.frame || "none",
    effect: p.effect || "none",
    nameStyle: p.nameStyle || "block",
    bio: p.bio || "",
    badges: p.badges || "",
  }));
  return derive({
    ...defaultState(),
    ...s,
    version: 3,
    deviceId: s.deviceId || uid(),
    events: s.events || [],
    tombs: s.tombs || [],
    sections: (s.sections || []).map((x) => ({ ...x, updatedAt: x.updatedAt || stamp })),
    people,
    settings: { ...defaultState().settings, ...s.settings, updatedAt: s.settings?.updatedAt || stamp },
  });
}

/* ================================================================== */
/*  reset scheduling                                                   */
/* ================================================================== */

function nextResetAfter(dateISO, settings) {
  const d = new Date(dateISO);
  const m = settings.resetMode;
  if (m === "never") return null;
  if (m === "weekly") {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    const delta = (7 + settings.resetWeekday - next.getDay()) % 7 || 7;
    next.setDate(next.getDate() + delta);
    return next;
  }
  if (m === "monthly") {
    const next = new Date(d.getFullYear(), d.getMonth(), settings.resetDay, 0, 0, 0, 0);
    if (next <= d) next.setMonth(next.getMonth() + 1);
    return next;
  }
  if (m === "custom") {
    const next = new Date(d);
    next.setDate(next.getDate() + Math.max(1, settings.customDays));
    return next;
  }
  return null;
}

function archivePeriod(state, stampISO) {
  const snapshot = {
    id: uid(),
    endedAt: stampISO || new Date().toISOString(),
    startedAt: state.settings.lastReset,
    totals: state.people.map((p) => ({ id: p.id, name: p.name, count: p.count })),
  };
  const t = Date.now();
  return derive({
    ...state,
    history: [...state.history, snapshot].slice(-52),
    people: state.people.map((p) => ({
      ...p,
      base: { ...(p.base || { allTime: 0, touch: 0 }), count: 0, since: t },
      updatedAt: t,
    })),
    settings: { ...state.settings, lastReset: new Date(t).toISOString(), updatedAt: t },
  });
}

function applyDueResets(state) {
  const due = nextResetAfter(state.settings.lastReset, state.settings);
  if (!due || new Date() < due) return state;
  return archivePeriod(state, due.toISOString());
}

/* ================================================================== */
/*  storage: window.storage in the artifact, localStorage in the PWA   */
/* ================================================================== */

const store = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage) {
      try {
        const r = await window.storage.get(key);
        return r ? r.value : null;
      } catch (e) { /* falls through to local */ }
    }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  async set(key, value) {
    if (typeof window !== "undefined" && window.storage) {
      try { await window.storage.set(key, value); return true; } catch (e) { /* falls through */ }
    }
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  },
};


/* ================================================================== */
/*  image handling                                                     */
/* ================================================================== */

function shrinkImage(file, max) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ================================================================== */
/*  charts, hand drawn so the app works offline                        */
/* ================================================================== */

function arcPath(cx, cy, rOuter, rInner, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(rOuter, a0);
  const [x1, y1] = p(rOuter, a1);
  if (rInner <= 0) {
    return `M ${cx} ${cy} L ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} Z`;
  }
  const [x2, y2] = p(rInner, a1);
  const [x3, y3] = p(rInner, a0);
  return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
}

function PieChartSvg({ data, donut }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const cx = 200, cy = 150, r = 118;
  let angle = -Math.PI / 2;
  return (
    <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%" }} role="img">
      {data.map((d) => {
        const span = (d.value / total) * Math.PI * 2;
        const path = arcPath(cx, cy, r, donut ? r * 0.52 : 0, angle, angle + span - 0.012);
        const mid = angle + span / 2;
        const lx = cx + (donut ? r * 0.78 : r * 0.66) * Math.cos(mid);
        const ly = cy + (donut ? r * 0.78 : r * 0.66) * Math.sin(mid);
        angle += span;
        const pct = Math.round((d.value / total) * 100);
        return (
          <g key={d.id}>
            <path d={path} fill={d.color} stroke={INK} strokeWidth="3.5" />
            {span > 0.35 && (
              <text x={lx} y={ly} textAnchor="middle" fontSize="15" fontWeight="700"
                fill={luminance(d.color) > 0.45 ? INK : PAPER}>
                {pct}%
              </text>
            )}
          </g>
        );
      })}
      {donut && (
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="34" fill={INK}
          style={{ fontFamily: "'Bebas Neue', Impact, sans-serif" }}>
          {total}
        </text>
      )}
    </svg>
  );
}

function BarChartSvg({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 400, H = 300, pad = 34, base = H - 44;
  const bw = Math.min(64, (W - pad * 2) / Math.max(1, data.length) - 14);
  const step = (W - pad * 2) / Math.max(1, data.length);
  return (
    <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%" }}>
      <line x1={pad - 8} y1={base} x2={W - pad + 8} y2={base} stroke={INK} strokeWidth="3" />
      {data.map((d, i) => {
        const h = (d.value / max) * (base - 40);
        const x = pad + step * i + (step - bw) / 2;
        return (
          <g key={d.id}>
            <rect x={x} y={base - h} width={bw} height={h} fill={d.color} stroke={INK} strokeWidth="3" />
            <text x={x + bw / 2} y={base - h - 9} textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}>{d.value}</text>
            <text x={x + bw / 2} y={base + 21} textAnchor="middle" fontSize="13" fill={INK}>
              {d.name.length > 9 ? d.name.slice(0, 8) + "\u2026" : d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* squarified treemap, the disk management look */
function squarify(items, x, y, w, h, out) {
  if (items.length === 0) return out;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return out;
  }
  const total = items.reduce((a, b) => a + b.value, 0);
  let acc = 0, split = 0;
  const half = total / 2;
  for (let i = 0; i < items.length; i++) {
    if (acc + items[i].value > half && i > 0) { split = i; break; }
    acc += items[i].value;
    split = i + 1;
  }
  const ratio = acc / total;
  const a = items.slice(0, split), b = items.slice(split);
  if (w >= h) {
    squarify(a, x, y, w * ratio, h, out);
    squarify(b, x + w * ratio, y, w * (1 - ratio), h, out);
  } else {
    squarify(a, x, y, w, h * ratio, out);
    squarify(b, x, y + h * ratio, w, h * (1 - ratio), out);
  }
  return out;
}

function TreemapSvg({ data }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const cells = squarify(sorted, 0, 0, 400, 300, []);
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%" }}>
      {cells.map((c) => (
        <g key={c.id}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={c.color} stroke={INK} strokeWidth="3.5" />
          {c.w > 62 && c.h > 40 && (
            <>
              <text x={c.x + 10} y={c.y + 24} fontSize="16" fontWeight="700" fill={luminance(c.color) > 0.45 ? INK : PAPER}>
                {c.name.length > 11 ? c.name.slice(0, 10) + "\u2026" : c.name}
              </text>
              <text x={c.x + 10} y={c.y + 44} fontSize="13" fill={luminance(c.color) > 0.45 ? INK : PAPER} opacity="0.8">
                {c.value} &middot; {Math.round((c.value / total) * 100)}%
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function RingsSvg({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const cx = 200, cy = 150;
  return (
    <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%" }}>
      {data.map((d, i) => {
        const r = 128 - i * (100 / Math.max(3, data.length));
        const span = (d.value / max) * Math.PI * 1.85;
        return (
          <g key={d.id}>
            <path d={arcPath(cx, cy, r, r - 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85)}
              fill={rgba(INK, 0.07)} stroke="none" />
            {span > 0.02 && (
              <path d={arcPath(cx, cy, r, r - 17, -Math.PI / 2, -Math.PI / 2 + span)}
                fill={d.color} stroke={INK} strokeWidth="2.5" />
            )}
            <text x={cx - r + 2} y={cy - 2} fontSize="12" fontWeight="700" fill={INK} textAnchor="end">
              {d.name.length > 8 ? d.name.slice(0, 7) + "\u2026" : d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RadarSvg({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const cx = 200, cy = 152, R = 108;
  const n = Math.max(3, data.length);
  const pt = (i, frac) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + R * frac * Math.cos(a), cy + R * frac * Math.sin(a)];
  };
  const web = [0.25, 0.5, 0.75, 1];
  const poly = data.map((d, i) => pt(i, d.value / max).join(",")).join(" ");
  return (
    <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%" }}>
      {web.map((f) => (
        <polygon key={f} points={Array.from({ length: n }, (_, i) => pt(i, f).join(",")).join(" ")}
          fill="none" stroke={rgba(INK, 0.22)} strokeWidth="1.5" />
      ))}
      {data.length >= 3 && (
        <polygon points={poly} fill={rgba(data[0].color, 0.5)} stroke={INK} strokeWidth="3" />
      )}
      {data.map((d, i) => {
        const [x, y] = pt(i, d.value / max);
        const [lx, ly] = pt(i, 1.16);
        return (
          <g key={d.id}>
            <circle cx={x} cy={y} r="6" fill={d.color} stroke={INK} strokeWidth="2.5" />
            <text x={lx} y={ly} textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>
              {d.name.length > 9 ? d.name.slice(0, 8) + "\u2026" : d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ================================================================== */
/*  shared bits                                                        */
/* ================================================================== */

const TORN_EDGE =
  "polygon(0% 0%, 97% 0%, 99% 6%, 95% 13%, 100% 21%, 96% 30%, 99% 39%, 94% 47%, 98% 56%, 95% 65%, 100% 73%, 96% 82%, 99% 90%, 95% 96%, 97% 100%, 0% 100%)";

function InkButton({ children, onClick, active, small, title, danger }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={small ? "pc-btn pc-btn-sm" : "pc-btn"}
      data-on={active ? "true" : undefined} data-danger={danger ? "true" : undefined}>
      {children}
    </button>
  );
}

function Halftone({ color, on }) {
  if (!on) return null;
  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.22,
      backgroundImage: `radial-gradient(${color} 1.1px, transparent 1.2px)`,
      backgroundSize: "7px 7px",
      maskImage: "linear-gradient(to top, black 0%, transparent 62%)",
      WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 62%)",
    }} />
  );
}

const SPARK_SEEDS = [7, 19, 31, 44, 56, 63, 71, 82, 91, 12, 27, 38, 49, 88];

function Effect({ kind, color, on }) {
  if (!on || kind === "none") return null;
  if (kind === "sparks" || kind === "drift") {
    return (
      <div aria-hidden="true" className="pc-fx" >
        {SPARK_SEEDS.map((s, i) => (
          <span key={i} className={kind === "sparks" ? "pc-spark" : "pc-drift"}
            style={{
              left: `${s}%`,
              background: color,
              animationDelay: `${(i * 0.47) % 5}s`,
              animationDuration: `${(kind === "sparks" ? 3.4 : 7) + (i % 4)}s`,
              width: kind === "drift" ? 7 : 4,
              height: kind === "drift" ? 7 : 12,
            }} />
        ))}
      </div>
    );
  }
  if (kind === "scan") {
    return <div aria-hidden="true" className="pc-fx pc-scan" style={{
      backgroundImage: `repeating-linear-gradient(to bottom, ${rgba(INK, 0.16)} 0 2px, transparent 2px 5px)`,
    }} />;
  }
  if (kind === "speed") {
    return <div aria-hidden="true" className="pc-fx pc-speed" style={{
      backgroundImage: `repeating-linear-gradient(74deg, ${rgba(INK, 0.2)} 0 3px, transparent 3px 26px)`,
    }} />;
  }
  if (kind === "glitch") {
    return (
      <div aria-hidden="true" className="pc-fx">
        <div className="pc-glitch" style={{ background: rgba(color, 0.35) }} />
        <div className="pc-glitch pc-glitch-b" style={{ background: rgba("#38BDF8", 0.3) }} />
      </div>
    );
  }
  return null;
}

function Avatar({ person, size, onPick, motion }) {
  const accent = person.theme.to;
  const frame = person.frame;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {frame === "spin" && (
        <svg viewBox="0 0 100 100" className={motion ? "pc-spin" : ""}
          style={{ position: "absolute", inset: -9, width: size + 18, height: size + 18, pointerEvents: "none" }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke={INK} strokeWidth="3.5" strokeDasharray="11 9" />
        </svg>
      )}
      {frame === "tape" && (
        <>
          <div className="pc-tape" style={{ top: -11, left: -13, transform: "rotate(-24deg)" }} />
          <div className="pc-tape" style={{ bottom: -11, right: -13, transform: "rotate(-24deg)" }} />
        </>
      )}
      <button type="button" onClick={(e) => { e.stopPropagation(); onPick && onPick(); }}
        title="Change picture" aria-label="Change picture" className="pc-avatar"
        style={{
          width: "100%", height: "100%",
          border: `3px solid ${INK}`,
          outline: frame === "ring" ? `3px solid ${INK}` : "none",
          outlineOffset: frame === "ring" ? 5 : 0,
          background: person.photo ? `center/cover url(${person.photo})` : "rgba(255,255,255,.55)",
          boxShadow: frame === "glow"
            ? `0 0 0 4px ${rgba(accent, 0.55)}, 0 0 26px 8px ${rgba(accent, 0.6)}, 7px 7px 0 ${INK}`
            : `7px 7px 0 ${INK}`,
          clipPath: frame === "spikes"
            ? "polygon(50% 0%, 61% 9%, 74% 4%, 79% 17%, 93% 19%, 91% 33%, 100% 44%, 92% 55%, 97% 69%, 84% 75%, 82% 89%, 68% 88%, 57% 97%, 46% 89%, 32% 93%, 27% 80%, 13% 77%, 15% 63%, 5% 52%, 14% 41%, 8% 28%, 21% 22%, 23% 8%, 37% 10%, 48% 1%)"
            : "none",
          cursor: onPick ? "pointer" : "default",
          display: "grid", placeItems: "center",
          color: INK, fontSize: 11, padding: 4,
          animation: frame === "glow" && motion ? "pcGlow 2.6s ease-in-out infinite" : "none",
        }}>
        {!person.photo && (size > 90 ? "add a picture" : "+")}
      </button>
    </div>
  );
}

function NameText({ person, fontSize, editable, onChange, color }) {
  const style = {
    fontSize, width: "100%", textAlign: "center", color,
    textOverflow: "ellipsis",
  };
  if (person.nameStyle === "gradient") {
    style.background = gradientCss({ ...person.theme, angle: 90 });
    style.WebkitBackgroundClip = "text";
    style.backgroundClip = "text";
    style.WebkitTextFillColor = "transparent";
    style.filter = `drop-shadow(3px 3px 0 ${INK})`;
  } else if (person.nameStyle === "outline") {
    style.WebkitTextStrokeWidth = "2px";
    style.WebkitTextStrokeColor = INK;
    style.color = "transparent";
  } else if (person.nameStyle === "sticker") {
    style.textShadow = `3px 3px 0 ${person.theme.to}, -2px -2px 0 ${PAPER}, 5px 5px 0 ${INK}`;
  }
  if (!editable) return <div className="pc-name" style={style}>{person.name}</div>;
  return (
    <input value={person.name} onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)} className="pc-name" style={style} />
  );
}

/* ================================================================== */
/*  panel                                                              */
/* ================================================================== */

function tierFor(width) {
  if (width >= 330) return 3;
  if (width >= 205) return 2;
  if (width >= 125) return 1;
  return 0;
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(9999);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function FriendPanel({
  person, settings, onBump, onEdit, onPhoto,
  expanded, onSelect, compact, last, fullscreen, onFullscreen, onClose, onCustomize,
}) {
  const fileRef = useRef(null);
  const [pulse, setPulse] = useState(0);
  const [wrapRef, width] = useWidth();
  const lastTap = useRef(0);

  const tier = fullscreen ? 3 : compact ? tierFor(width) : 3;
  const roomy = tier === 3;
  const fg = inkOrPaper(person);
  const soft = fg === INK ? INK : PAPER;

  const bump = (n) => { onBump(person.id, n); setPulse((k) => k + 1); };

  const handleTouchEnd = (e) => {
    if (!onFullscreen) return;
    const now = Date.now();
    if (now - lastTap.current < 320) { e.preventDefault(); onFullscreen(person.id); lastTap.current = 0; }
    else lastTap.current = now;
  };

  const since = person.lastTouch ? Math.floor((Date.now() - new Date(person.lastTouch)) / 86400000) : null;
  const backdrop = fullscreen ? (person.banner || person.photo) : (settings.photoBackdrop ? person.photo : null);
  const wash = gradientCss(person.theme, backdrop ? 0.86 : 1);
  const badges = (person.badges || "").split(",").map((b) => b.trim()).filter(Boolean);

  return (
    <div ref={wrapRef} onClick={onSelect}
      onDoubleClick={onFullscreen ? (e) => { e.stopPropagation(); onFullscreen(person.id); } : undefined}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "relative",
        flex: fullscreen ? "1 1 auto" : expanded ? "2.6 1 0" : "1 1 0",
        minWidth: 0, height: "100%", overflow: "hidden",
        cursor: onSelect && !expanded ? "pointer" : "default",
        transition: settings.motion ? "flex 520ms cubic-bezier(.16,1,.3,1)" : "none",
        background: backdrop ? `${wash}, center/cover no-repeat url(${backdrop})` : wash,
        /* the tear belongs on the seam between panels, so the last one keeps
           a straight edge instead of looking ripped off at the screen edge */
        clipPath: compact && !fullscreen && !last ? TORN_EDGE : "none",
      }}>

      <Halftone color={person.theme.to} on={settings.halftone} />
      <Effect kind={person.effect} color={person.theme.to} on={settings.motion} />

      {onFullscreen && tier >= 1 && (
        <button type="button" className="pc-btn pc-corner" title={`Open ${person.name} full screen`}
          aria-label={`Open ${person.name} full screen`}
          onClick={(e) => { e.stopPropagation(); onFullscreen(person.id); }}>&#9974;</button>
      )}
      {onClose && (
        <button type="button" className="pc-btn pc-corner" title="Back to panels" aria-label="Back to panels"
          onClick={(e) => { e.stopPropagation(); onClose(); }}>&#10005;</button>
      )}

      <div style={{
        position: "relative", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", overflowY: fullscreen ? "auto" : "hidden",
        padding: roomy ? "34px 20px" : tier === 2 ? "18px 10px" : "12px 4px",
        gap: roomy ? 13 : 9,
      }}>

        {tier >= 2 && (
          <>
            <Avatar person={person} motion={settings.motion}
              size={fullscreen ? 176 : roomy ? 124 : 76}
              onPick={() => fileRef.current?.click()} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(person.id, f, "photo"); e.target.value = ""; }} />
          </>
        )}

        {tier >= 1 && (
          <NameText person={person} color={fg} editable
            onChange={(v) => onEdit(person.id, { name: v })}
            fontSize={fullscreen ? "clamp(42px, 7.5vw, 90px)"
              : roomy ? "clamp(28px, 4.6vw, 56px)"
              : tier === 2 ? "clamp(19px, 3vw, 30px)" : "clamp(14px, 2.4vw, 20px)"} />
        )}

        {badges.length > 0 && tier >= 2 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {badges.slice(0, 6).map((b, i) => (
              <span key={i} style={{
                fontSize: 11.5, fontWeight: 700, padding: "3px 9px",
                border: `2px solid ${fg}`, color: fg, background: rgba(fg === INK ? PAPER : INK, 0.35),
              }}>{b}</span>
            ))}
          </div>
        )}

        <div key={pulse} className={settings.motion ? "pc-pop" : ""}
          style={{
            fontFamily: "'Bebas Neue', Impact, 'Arial Narrow Bold', sans-serif",
            fontSize: fullscreen ? "clamp(84px, 16vw, 200px)"
              : roomy ? "clamp(56px, 10vw, 126px)"
              : tier === 2 ? "clamp(38px, 6vw, 62px)"
              : tier === 1 ? "clamp(28px, 4.5vw, 44px)" : "clamp(20px, 3.4vw, 32px)",
            lineHeight: 0.82, color: fg,
            textShadow: `5px 5px 0 ${fg === INK ? person.theme.to : INK}`, letterSpacing: 1,
          }}>
          {person.count}
        </div>

        {/* stacked in the narrowest panels, where two 44px buttons will not sit side by side */}
        <div onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", gap: tier >= 2 ? 8 : 5, flexDirection: tier === 0 ? "column" : "row" }}>
          <button type="button" className={tier >= 2 ? "pc-btn pc-round" : "pc-btn pc-round pc-round-sm"}
            onClick={() => bump(-1)} aria-label={`Subtract from ${person.name}`}>&minus;</button>
          <button type="button" className={tier >= 2 ? "pc-btn pc-round" : "pc-btn pc-round pc-round-sm"}
            onClick={() => bump(1)} aria-label={`Add to ${person.name}`}>+</button>
        </div>

        {roomy && (
          <div style={{ textAlign: "center", fontSize: fullscreen ? 15 : 12.5, color: soft, opacity: 0.78, lineHeight: 1.7 }}>
            <div>{person.allTime} all time</div>
            <div>{since === null ? "no time logged yet" : since === 0 ? "last logged today" : `last logged ${since}d ago`}</div>
          </div>
        )}

        {fullscreen && settings.showBios && person.bio && (
          <p style={{
            maxWidth: 480, textAlign: "center", fontSize: 14.5, lineHeight: 1.7, color: fg,
            background: rgba(fg === INK ? PAPER : INK, 0.5), border: `2px solid ${fg}`,
            padding: "10px 14px", margin: 0, whiteSpace: "pre-wrap",
          }}>{person.bio}</p>
        )}

        {fullscreen && onCustomize && (
          <InkButton small onClick={() => onCustomize(person.id)}>Customize this profile</InkButton>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  customize drawer                                                   */
/* ================================================================== */

function GradientSwatch({ theme, active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="pc-btn pc-swatch" data-on={active ? "true" : undefined}
      aria-pressed={active ? "true" : "false"}
      style={{ background: gradientCss(theme), borderColor: active ? INK : rgba(INK, 0.35) }} />
  );
}

function CustomizeDrawer({ person, onEdit, onPhoto, onClose, settings }) {
  const bannerRef = useRef(null);
  const t = person.theme;
  const set = (patch) => onEdit(person.id, patch);
  const setTheme = (patch) => set({ theme: { ...t, ...patch } });

  return (
    <div className="pc-drawer">
      <div className="pc-drawer-inner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <div className="pc-name" style={{ fontSize: 28 }}>{person.name}</div>
          <InkButton small onClick={onClose}>Done</InkButton>
        </div>

        <div style={{
          height: 96, marginBottom: 18, border: `3px solid ${INK}`,
          background: person.banner
            ? `${gradientCss(t, 0.86)}, center/cover url(${person.banner})`
            : gradientCss(t),
          display: "grid", placeItems: "center",
        }}>
          <NameText person={person} color={inkOrPaper(person)} fontSize={34} />
        </div>

        <Section title="Gradient presets">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {GRADIENT_PRESETS.map((g) => (
              <GradientSwatch key={g.id} label={g.name} theme={g}
                active={t.from === g.from && t.to === g.to}
                onClick={() => setTheme({ from: g.from, to: g.to, angle: g.angle })} />
            ))}
          </div>
        </Section>

        <Section title="Build your own">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <label className="pc-field">
              <span>From</span>
              <input type="color" value={t.from} onChange={(e) => setTheme({ from: e.target.value })} />
            </label>
            <label className="pc-field">
              <span>To</span>
              <input type="color" value={t.to} onChange={(e) => setTheme({ to: e.target.value })} />
            </label>
            <InkButton small onClick={() => setTheme({ from: t.to, to: t.from })}>Swap</InkButton>
          </div>
          <label className="pc-field" style={{ width: "100%", marginTop: 12 }}>
            <span>Angle {t.angle}&deg;</span>
            <input type="range" min="0" max="360" value={t.angle}
              onChange={(e) => setTheme({ angle: +e.target.value })} style={{ flex: 1 }} />
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => setTheme({ to: c })} aria-label={`Set second color to ${c}`}
                className="pc-btn pc-chip"><span style={{ background: c }} /></button>
            ))}
          </div>
        </Section>

        <Section title="Text color">
          {["auto", "dark", "light"].map((m) => (
            <InkButton key={m} small active={person.textMode === m} onClick={() => set({ textMode: m })}>
              {m === "auto" ? "Auto" : m === "dark" ? "Ink" : "Paper"}
            </InkButton>
          ))}
        </Section>

        <Section title="Banner" hint="Fills the background when this profile is open full screen.">
          <InkButton small onClick={() => bannerRef.current?.click()}>
            {person.banner ? "Change banner" : "Upload a banner"}
          </InkButton>
          {person.banner && <InkButton small danger onClick={() => set({ banner: null })}>Remove</InkButton>}
          <input ref={bannerRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(person.id, f, "banner"); e.target.value = ""; }} />
        </Section>

        <Section title="Picture frame">
          {FRAMES.map((f) => (
            <InkButton key={f.id} small active={person.frame === f.id} onClick={() => set({ frame: f.id })}>{f.name}</InkButton>
          ))}
        </Section>

        <Section title="Profile effect" hint="Animated overlay on the panel. Needs animation switched on in settings.">
          {EFFECTS.map((f) => (
            <InkButton key={f.id} small active={person.effect === f.id} onClick={() => set({ effect: f.id })}>{f.name}</InkButton>
          ))}
        </Section>

        <Section title="Name style">
          {NAME_STYLES.map((f) => (
            <InkButton key={f.id} small active={person.nameStyle === f.id} onClick={() => set({ nameStyle: f.id })}>{f.name}</InkButton>
          ))}
        </Section>

        <Section title="Tags" hint="Comma separated. Shows as small badges under the name.">
          <input className="pc-select" style={{ width: "100%" }} value={person.badges}
            placeholder="night owl, calls only, best friend"
            onChange={(e) => set({ badges: e.target.value })} />
        </Section>

        <Section title="About them" hint="Shows on the full screen profile.">
          <textarea className="pc-select" rows={3} style={{ width: "100%", resize: "vertical" }}
            value={person.bio} placeholder="Timezone, what you two do, whatever helps."
            onChange={(e) => set({ bio: e.target.value })} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div style={{ padding: "14px 0", borderTop: `1px solid ${rgba(INK, 0.16)}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: hint ? 3 : 9 }}>{title}</div>
      {hint && <p style={{ fontSize: 12.5, opacity: 0.66, margin: "0 0 10px", lineHeight: 1.55 }}>{hint}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>{children}</div>
    </div>
  );
}

/* ================================================================== */
/*  ask for one name, used for the first page and the first person     */
/* ================================================================== */

function PromptCard({ title, blurb, placeholder, cta, onSubmit }) {
  const [value, setValue] = useState("");
  const go = (e) => { e.preventDefault(); onSubmit(value); setValue(""); };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: PAPER, display: "grid", placeItems: "center", padding: 22 }}>
      <form onSubmit={go} style={{
        width: "100%", maxWidth: 420, background: "#fff",
        border: `3px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, padding: "20px 20px 22px",
      }}>
        <div className="pc-name" style={{ fontSize: 38, lineHeight: 1.02, marginBottom: 8 }}>{title}</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.75, margin: "0 0 16px" }}>{blurb}</p>
        <input className="pc-select" autoFocus value={value} placeholder={placeholder} aria-label={title}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: "100%", marginBottom: 12, fontSize: 15 }} />
        <InkButton onClick={go}>{cta}</InkButton>
      </form>
    </div>
  );
}

/* ================================================================== */
/*  panels view                                                        */
/* ================================================================== */

function PanelsView({ people, settings, handlers, pageName, onAddPerson }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [ripKey, setRipKey] = useState(0);
  const [fsId, setFsId] = useState(null);
  const [customId, setCustomId] = useState(null);

  useEffect(() => { if (index > people.length - 1) setIndex(0); }, [people.length, index]);

  useEffect(() => {
    if (!fsId && !customId) return;
    const onKey = (e) => { if (e.key === "Escape") { if (customId) setCustomId(null); else setFsId(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fsId, customId]);

  const fsPerson = people.find((p) => p.id === fsId) || null;
  const customPerson = people.find((p) => p.id === customId) || null;

  if (people.length === 0) {
    return (
      <PromptCard
        title={pageName ? `Who goes on ${pageName}?` : "Add the first person"}
        blurb="Everyone you add gets a panel of their own, with a plus and a minus on it. You can change how they look later."
        placeholder="Their name" cta="Add them" onSubmit={onAddPerson} />
    );
  }

  const drawer = customPerson && (
    <CustomizeDrawer person={customPerson} settings={settings} onEdit={handlers.onEdit}
      onPhoto={handlers.onPhoto} onClose={() => setCustomId(null)} />
  );

  if (fsPerson) {
    return (
      <div style={{ height: "100%", background: INK, padding: 5, position: "relative" }}>
        <div className={settings.motion ? "pc-impact" : ""} style={{ height: "100%" }}>
          <FriendPanel person={fsPerson} settings={settings} fullscreen
            onClose={() => setFsId(null)} onCustomize={setCustomId} {...handlers} />
        </div>
        {drawer}
      </div>
    );
  }

  const move = (dir) => { setIndex((i) => (i + dir + people.length) % people.length); setRipKey((k) => k + 1); };

  if (settings.transition === "split") {
    return (
      <div style={{ height: "100%", display: "flex", gap: 5, background: INK, padding: 5, position: "relative" }}>
        {people.map((p, i) => (
          <FriendPanel key={p.id} person={p} settings={settings} compact
            last={i === people.length - 1}
            expanded={expanded === p.id || people.length === 1}
            onSelect={() => setExpanded(expanded === p.id ? null : p.id)}
            onFullscreen={setFsId} {...handlers} />
        ))}
        {drawer}
      </div>
    );
  }

  const current = people[Math.min(index, people.length - 1)];
  const anim = settings.transition === "carousel" ? "pc-rip" : settings.transition === "slide" ? "pc-slide" : "pc-impact";

  return (
    <div style={{ height: "100%", position: "relative", background: INK, padding: 5, overflow: "hidden" }}>
      <div key={`${current.id}-${ripKey}`} className={settings.motion ? anim : ""} style={{ height: "100%" }}>
        <FriendPanel person={current} settings={settings} expanded onFullscreen={setFsId} {...handlers} />
      </div>
      <button type="button" className="pc-btn pc-nav" style={{ left: 14 }} onClick={() => move(-1)} aria-label="Previous friend">&#8592;</button>
      <button type="button" className="pc-btn pc-nav" style={{ right: 14 }} onClick={() => move(1)} aria-label="Next friend">&#8594;</button>
      <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 7 }}>
        {people.map((p, i) => (
          <button key={p.id} type="button" className="pc-dot" aria-label={`Go to ${p.name}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => { setIndex(i); setRipKey((k) => k + 1); }}>
            <span style={{
              width: i === index ? 26 : 11,
              background: i === index ? p.theme.to : PAPER,
              transition: settings.motion ? "width 260ms" : "none",
            }} />
          </button>
        ))}
      </div>
      {drawer}
    </div>
  );
}

/* ================================================================== */
/*  dashboard                                                          */
/* ================================================================== */

function Dashboard({ state, people, setSettings }) {
  const { settings } = state;
  const pool = settings.chartScope === "all" ? state.people : people;
  const data = pool.map((p) => ({
    id: p.id,
    name: p.name || "unnamed",
    value: Math.max(0, settings.chartSource === "allTime" ? p.allTime : p.count),
    color: p.theme.to,
  }));
  const live = data.filter((d) => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);
  const grand = state.people.reduce((a, b) => a + b.allTime, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const gap = sorted.length ? sorted[0].value - sorted[sorted.length - 1].value : 0;

  const chart = () => {
    if (live.length === 0) {
      return (
        <div style={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", padding: 20 }}>
          <div>
            <div className="pc-name" style={{ fontSize: 26 }}>Nothing counted yet</div>
            <p style={{ fontSize: 13.5, opacity: 0.68, marginTop: 6 }}>Hit + on a panel and the chart fills in.</p>
          </div>
        </div>
      );
    }
    switch (settings.chart) {
      case "pie": return <PieChartSvg data={live} />;
      case "donut": return <PieChartSvg data={live} donut />;
      case "treemap": return <TreemapSvg data={live} />;
      case "bar": return <BarChartSvg data={data} />;
      case "rings": return <RingsSvg data={data} />;
      case "radar": return <RadarSvg data={data} />;
      default: return null;
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: PAPER }}>
      <div style={{ padding: "20px 20px 44px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          {CHART_TYPES.map((c) => (
            <InkButton key={c.id} small active={settings.chart === c.id} onClick={() => setSettings({ chart: c.id })}>{c.label}</InkButton>
          ))}
        </div>

        {/* each pair wraps as a unit, so the two questions never read as one row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 7 }}>
            <InkButton small active={settings.chartSource === "period"} onClick={() => setSettings({ chartSource: "period" })}>This period</InkButton>
            <InkButton small active={settings.chartSource === "allTime"} onClick={() => setSettings({ chartSource: "allTime" })}>All time</InkButton>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <InkButton small active={settings.chartScope === "section"} onClick={() => setSettings({ chartScope: "section" })}>This page</InkButton>
            <InkButton small active={settings.chartScope === "all"} onClick={() => setSettings({ chartScope: "all" })}>Everyone</InkButton>
          </div>
        </div>

        <div style={{ height: 340, border: `3px solid ${INK}`, boxShadow: `9px 9px 0 ${INK}`, background: "#fff", padding: 12, marginBottom: 26 }}>
          {chart()}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 26 }}>
          <StatBlock label={settings.chartSource === "allTime" ? "shown total" : "this period"} value={total} />
          <StatBlock label="all time, everyone" value={grand} />
          <StatBlock label="gap, most to least" value={gap} tone={gap >= 5 ? "#F43F5E" : INK} />
        </div>

        <h2 className="pc-name" style={{ fontSize: 24, marginBottom: 10 }}>Breakdown</h2>
        <div style={{ border: `3px solid ${INK}`, background: "#fff" }}>
          {pool.length === 0 && <div style={{ padding: 16, fontSize: 13.5, opacity: 0.7 }}>No friends in this view.</div>}
          {pool.map((p) => {
            const v = settings.chartSource === "allTime" ? p.allTime : p.count;
            const pct = total > 0 ? (v / total) * 100 : 0;
            return (
              <div key={p.id} style={{ padding: "11px 14px", borderBottom: `1px solid ${rgba(INK, 0.15)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{p.name || "unnamed"}</span>
                  <span style={{ opacity: 0.7 }}>{v} &middot; {Math.round(pct)}%</span>
                </div>
                <div style={{ height: 11, border: `2px solid ${INK}`, background: PAPER }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: gradientCss({ ...p.theme, angle: 90 }), transition: "width 420ms" }} />
                </div>
              </div>
            );
          })}
        </div>

        {state.history.length > 0 && (
          <>
            <h2 className="pc-name" style={{ fontSize: 24, margin: "26px 0 10px" }}>Past periods</h2>
            <div style={{ border: `3px solid ${INK}`, background: "#fff", fontSize: 13.5 }}>
              {[...state.history].reverse().slice(0, 8).map((h) => (
                <div key={h.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${rgba(INK, 0.15)}` }}>
                  <div style={{ opacity: 0.6, marginBottom: 3 }}>ended {new Date(h.endedAt).toLocaleDateString()}</div>
                  <div>{h.totals.map((t) => `${t.name} ${t.count}`).join("   ")}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, tone = INK }) {
  return (
    <div style={{ border: `3px solid ${INK}`, background: "#fff", padding: "13px 15px" }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4 }}>{label}</div>
      <div className="pc-name" style={{ fontSize: 38, lineHeight: 1, color: tone }}>{value}</div>
    </div>
  );
}

/* ================================================================== */
/*  settings                                                           */
/* ================================================================== */

function NameForm({ placeholder, cta, onSubmit }) {
  const [value, setValue] = useState("");
  const go = (e) => { e.preventDefault(); onSubmit(value); setValue(""); };
  return (
    <form onSubmit={go} style={{ display: "flex", gap: 7, width: "100%", flexWrap: "wrap" }}>
      <input className="pc-select" style={{ flex: "1 1 150px" }} value={value}
        placeholder={placeholder} aria-label={cta} onChange={(e) => setValue(e.target.value)} />
      <InkButton small onClick={go}>{cta}</InkButton>
    </form>
  );
}

function Row({ title, hint, children }) {
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${rgba(INK, 0.16)}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: hint ? 3 : 9 }}>{title}</div>
      {hint && <p style={{ fontSize: 13, opacity: 0.66, margin: "0 0 10px", lineHeight: 1.55, maxWidth: 620 }}>{hint}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>{children}</div>
    </div>
  );
}

function SettingsView({ state, setSettings, actions, sectionId, onCustomize, installPrompt, onInstall, syncer }) {
  const { settings } = state;
  const due = nextResetAfter(settings.lastReset, settings);
  const inSection = state.people.filter((p) => p.sectionId === sectionId);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: PAPER }}>
      <div style={{ padding: "20px 20px 60px", maxWidth: 780, margin: "0 auto" }}>

        {installPrompt && (
          <div style={{ border: `3px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, padding: 14, marginBottom: 22, background: "#fff" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Install this on your device</div>
            <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 10px", lineHeight: 1.55 }}>
              Runs full screen with its own icon, and works with no connection.
            </p>
            <InkButton small onClick={onInstall}>Install</InkButton>
          </div>
        )}

        <h2 className="pc-name" style={{ fontSize: 30, marginBottom: 2 }}>Panels</h2>
        <Row title="Transition style" hint={TRANSITIONS.find((t) => t.id === settings.transition)?.hint}>
          {TRANSITIONS.map((t) => (
            <InkButton key={t.id} small active={settings.transition === t.id} onClick={() => setSettings({ transition: t.id })}>{t.label}</InkButton>
          ))}
        </Row>
        <Row title="Halftone texture" hint="The comic dot screen bleeding up from the bottom of each panel.">
          <InkButton small active={settings.halftone} onClick={() => setSettings({ halftone: true })}>On</InkButton>
          <InkButton small active={!settings.halftone} onClick={() => setSettings({ halftone: false })}>Off</InkButton>
        </Row>
        <Row title="Picture fills the panel" hint="Their picture becomes the panel background under the gradient. Full screen uses their banner instead when they have one.">
          <InkButton small active={settings.photoBackdrop} onClick={() => setSettings({ photoBackdrop: true })}>On</InkButton>
          <InkButton small active={!settings.photoBackdrop} onClick={() => setSettings({ photoBackdrop: false })}>Off</InkButton>
        </Row>
        <Row title="Show the about text" hint="The bio written in a profile, shown on the full screen view.">
          <InkButton small active={settings.showBios} onClick={() => setSettings({ showBios: true })}>On</InkButton>
          <InkButton small active={!settings.showBios} onClick={() => setSettings({ showBios: false })}>Off</InkButton>
        </Row>
        <Row title="Animation" hint="Turns off profile effects, transitions and the count pop. Use it if the movement gets distracting.">
          <InkButton small active={settings.motion} onClick={() => setSettings({ motion: true })}>On</InkButton>
          <InkButton small active={!settings.motion} onClick={() => setSettings({ motion: false })}>Off</InkButton>
        </Row>

        <h2 className="pc-name" style={{ fontSize: 30, margin: "30px 0 2px" }}>Counting</h2>
        <Row title="Reset the counters" hint="All time totals never reset. This clears the current period and files the old numbers under past periods on the dashboard.">
          {RESET_MODES.map((m) => (
            <InkButton key={m.id} small active={settings.resetMode === m.id} onClick={() => setSettings({ resetMode: m.id })}>{m.label}</InkButton>
          ))}
        </Row>
        {settings.resetMode === "weekly" && (
          <Row title="Reset day">
            <select className="pc-select" value={settings.resetWeekday} onChange={(e) => setSettings({ resetWeekday: +e.target.value })}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Row>
        )}
        {settings.resetMode === "monthly" && (
          <Row title="Reset date">
            <select className="pc-select" value={settings.resetDay} onChange={(e) => setSettings({ resetDay: +e.target.value })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}
            </select>
          </Row>
        )}
        {settings.resetMode === "custom" && (
          <Row title="Days per period">
            <input type="number" min="1" max="365" className="pc-select" style={{ width: 90 }}
              value={settings.customDays} onChange={(e) => setSettings({ customDays: Math.max(1, +e.target.value || 1) })} />
          </Row>
        )}
        <Row title="Current period"
          hint={`Started ${new Date(settings.lastReset).toLocaleDateString()}. ${due ? `Next automatic reset ${due.toLocaleDateString()}.` : "No automatic reset scheduled."}`}>
          <InkButton small onClick={actions.resetNow}>Reset now and file it</InkButton>
        </Row>

        <h2 className="pc-name" style={{ fontSize: 30, margin: "30px 0 2px" }}>Pages</h2>
        <Row title="Your pages" hint="A page is a group of panels. Deleting one deletes the people on it. There is a + at the end of the page tabs that does the same job as the box below.">
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            {state.sections.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input className="pc-select" style={{ flex: 1 }} value={s.name}
                  onChange={(e) => actions.renameSection(s.id, e.target.value)} />
                <InkButton small danger onClick={() => actions.deleteSection(s.id)}>Delete</InkButton>
              </div>
            ))}
            <NameForm placeholder="New page" cta="Add a page" onSubmit={actions.addSection} />
          </div>
        </Row>

        <h2 className="pc-name" style={{ fontSize: 30, margin: "30px 0 2px" }}>People on this page</h2>
        <Row title="Profiles" hint="Open a profile to change its colors, banner, frame, effect and tags.">
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            {!sectionId && <div style={{ fontSize: 13.5, opacity: 0.65 }}>Make a page first and this fills in.</div>}
            {sectionId && inSection.length === 0 && <div style={{ fontSize: 13.5, opacity: 0.65 }}>Nobody on this page yet.</div>}
            {inSection.map((p) => (
              <div key={p.id} style={{ border: `2px solid ${INK}`, background: "#fff" }}>
                <div style={{ height: 8, background: gradientCss({ ...p.theme, angle: 90 }) }} />
                <div style={{ padding: 11 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
                    <input className="pc-select" style={{ flex: "1 1 140px" }} value={p.name}
                      onChange={(e) => actions.editPerson(p.id, { name: e.target.value })} />
                    <InkButton small onClick={() => onCustomize(p.id)}>Customize</InkButton>
                    <InkButton small danger onClick={() => actions.deletePerson(p.id)}>Remove</InkButton>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, opacity: 0.7 }}>
                      {p.count} this period, {p.allTime} all time
                    </span>
                    <InkButton small onClick={() => actions.zeroPerson(p.id)}>Zero the period</InkButton>
                  </div>
                </div>
              </div>
            ))}
            {sectionId && <NameForm placeholder="Their name" cta="Add them" onSubmit={(n) => actions.addPerson(sectionId, n)} />}
          </div>
        </Row>

        <h2 className="pc-name" style={{ fontSize: 30, margin: "30px 0 2px" }}>Sync</h2>
        <SyncSettings syncer={syncer} />

        <h2 className="pc-name" style={{ fontSize: 30, margin: "30px 0 2px" }}>Help</h2>
        <Row title="Show me around" hint="The walkthrough from the first run. Pages, panels, counting, and where the rest of it is.">
          <InkButton small onClick={actions.showTour}>Run the walkthrough</InkButton>
        </Row>

        <h2 className="pc-name" style={{ fontSize: 30, margin: "30px 0 2px" }}>Data</h2>
        <Row title="Back it up" hint="Saves a file with every profile, picture and count. Import it on another device to move everything over.">
          <InkButton small onClick={actions.exportData}>Export a backup</InkButton>
          <InkButton small onClick={actions.importData}>Import a backup</InkButton>
        </Row>
        <Row title="Start over" hint="Clears every page, person, count and past period. It cannot be undone.">
          <InkButton small danger onClick={actions.wipe}>Erase everything</InkButton>
        </Row>
      </div>
    </div>
  );
}


/* ================================================================== */
/*  the sync loop                                                      */
/* ================================================================== */

function useSync(state, setState) {
  const [providerId, setProviderId] = useState(() => localStorage.getItem("panelcount:provider") || "");
  const [sync, setSync] = useState({ phase: "idle", at: 0, error: "" });
  const busy = useRef(false);
  const pending = useRef(false);
  const lastPushed = useRef("");
  const stateRef = useRef(state);
  stateRef.current = state;

  const provider = providerId ? PROVIDERS[providerId] : null;
  const linked = !!provider && provider.linked();

  const run = useCallback(async (reason) => {
    const s = stateRef.current;
    if (!s || !provider || !provider.linked()) return;
    if (!navigator.onLine) { setSync((v) => ({ ...v, phase: "offline" })); return; }
    if (busy.current) { pending.current = true; return; }

    busy.current = true;
    setSync((v) => ({ ...v, phase: "syncing", error: "" }));
    try {
      const remote = await provider.pull();
      const merged = remote ? mergeStates(stateRef.current, remote) : stateRef.current;
      const mergedPrint = fingerprint(merged);

      if (mergedPrint !== fingerprint(stateRef.current)) setState(merged);
      if (!remote || mergedPrint !== fingerprint(remote)) {
        await provider.push(syncPayload(merged));
      }
      lastPushed.current = mergedPrint;
      setSync({ phase: "ok", at: Date.now(), error: "" });
    } catch (err) {
      setSync({ phase: "error", at: Date.now(), error: err.message || "Sync failed" });
    } finally {
      busy.current = false;
      if (pending.current) { pending.current = false; setTimeout(() => run("queued"), 400); }
    }
  }, [provider, setState]);

  /* pick up a token handed back by the Discord worker */
  useEffect(() => {
    if (customServer.captureRedirect()) {
      localStorage.setItem("panelcount:provider", "server");
      setProviderId("server");
    }
  }, []);

  /* the moment it smells internet */
  useEffect(() => {
    if (!linked) return;
    const kick = () => run("event");
    window.addEventListener("online", kick);
    const onVis = () => { if (document.visibilityState === "visible") kick(); };
    document.addEventListener("visibilitychange", onVis);
    const timer = setInterval(() => { if (document.visibilityState === "visible") kick(); }, 180000);
    kick();
    return () => {
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(timer);
    };
  }, [linked, run]);

  /* and shortly after anything changes */
  useEffect(() => {
    if (!linked || !state) return;
    const print = fingerprint(state);
    if (print === lastPushed.current) return;
    const t = setTimeout(() => run("change"), 4000);
    return () => clearTimeout(t);
  }, [state, linked, run]);

  const connect = async (id) => {
    const p = PROVIDERS[id];
    setSync({ phase: "syncing", at: 0, error: "" });
    try {
      const done = await p.connect();
      if (done === false) return;
      localStorage.setItem("panelcount:provider", id);
      setProviderId(id);
      setSync({ phase: "ok", at: Date.now(), error: "" });
      setTimeout(() => run("connect"), 200);
    } catch (err) {
      setSync({ phase: "error", at: Date.now(), error: err.message || "Could not connect" });
    }
  };

  const disconnect = () => {
    if (provider) provider.disconnect();
    localStorage.removeItem("panelcount:provider");
    setProviderId("");
    setSync({ phase: "idle", at: 0, error: "" });
  };

  return { providerId, provider, linked, sync, run, connect, disconnect };
}

function SyncPill({ sync, linked, onClick }) {
  if (!linked) return null;
  const map = {
    syncing: ["Syncing", "#FACC15"],
    ok: ["Synced", "#7FE03C"],
    error: ["Sync failed", "#F43F5E"],
    offline: ["Offline", "#94A3B8"],
    idle: ["Waiting", "#94A3B8"],
  };
  const [label, color] = map[sync.phase] || map.idle;
  return (
    <button type="button" onClick={onClick} title={sync.error || "Sync now"}
      className="pc-btn pc-btn-sm" style={{ background: color }}>
      <span className="pc-pill-dot" style={{
        width: 8, height: 8, borderRadius: "50%", background: INK, flexShrink: 0,
        animation: sync.phase === "syncing" ? "pcBlink 1s infinite" : "none",
      }} />
      {label}
    </button>
  );
}


function SyncSettings({ syncer }) {
  const [clientId, setClientId] = useState(() => localStorage.getItem("panelcount:googleClientId") || "");
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("panelcount:serverUrl") || "");
  const { sync, linked, providerId } = syncer;

  const saveClientId = (v) => {
    setClientId(v);
    if (v.trim()) localStorage.setItem("panelcount:googleClientId", v.trim());
    else localStorage.removeItem("panelcount:googleClientId");
  };
  const saveServerUrl = (v) => {
    setServerUrl(v);
    if (v.trim()) localStorage.setItem("panelcount:serverUrl", v.trim());
    else localStorage.removeItem("panelcount:serverUrl");
  };

  if (linked) {
    const who = providerId === "google" ? "Google Drive" : "Discord";
    const stamp = sync.at ? new Date(sync.at).toLocaleTimeString() : "not yet";
    return (
      <>
        <Row title={`Connected to ${who}`}
          hint={`Last sync ${stamp}. It syncs on open, when the connection comes back, when you switch back to the app, and a few seconds after any change.`}>
          <InkButton small onClick={() => syncer.run("manual")}>Sync now</InkButton>
          <InkButton small danger onClick={syncer.disconnect}>Disconnect</InkButton>
        </Row>
        {sync.error && (
          <div style={{ border: `3px solid #F43F5E`, padding: 12, fontSize: 13, marginTop: 12, background: "#fff" }}>
            {sync.error}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Row title="Google Drive"
        hint="Keeps a hidden file in your own Drive that only this app can see. No server to run, and nothing counts against anyone but you. It needs a client ID from Google first, which is a fifteen minute job you only do once. The steps are in docs/sync.md.">
        <input className="pc-select" style={{ width: "100%", marginBottom: 8, fontSize: 12.5 }}
          placeholder="1234-abcd.apps.googleusercontent.com"
          value={clientId} onChange={(e) => saveClientId(e.target.value)} />
        <InkButton small onClick={() => syncer.connect("google")}>Connect Google Drive</InkButton>
      </Row>

      <Row title="Discord"
        hint="Discord can prove who you are but it has no place to keep files, so this one talks to the small server in the worker folder. Deploy it once, paste its address here, then log in with Discord.">
        <input className="pc-select" style={{ width: "100%", marginBottom: 8, fontSize: 12.5 }}
          placeholder="https://panel-count.yourname.workers.dev"
          value={serverUrl} onChange={(e) => saveServerUrl(e.target.value)} />
        <InkButton small onClick={() => syncer.connect("server")}>Log in with Discord</InkButton>
      </Row>

      {sync.error && (
        <div style={{ border: `3px solid #F43F5E`, padding: 12, fontSize: 13, background: "#fff" }}>{sync.error}</div>
      )}
    </>
  );
}


const BRAND_FX = ["pc-b-flip", "pc-b-tear", "pc-b-stamp", "pc-b-slide", "pc-b-glitch", "pc-b-type"];

function Brand({ motion }) {
  const [open, setOpen] = useState(false);
  const [fx, setFx] = useState(BRAND_FX[0]);
  const [run, setRun] = useState(0);

  const toggle = () => {
    // a different transition every time, never the same one twice in a row
    const pool = BRAND_FX.filter((f) => f !== fx);
    setFx(pool[Math.floor(Math.random() * pool.length)]);
    setRun((k) => k + 1);
    setOpen((o) => !o);
  };

  return (
    <button type="button" onClick={toggle} className="pc-brand"
      title={open ? "Back to FST" : "What FST stands for"}
      aria-label={open ? "Friendship Tracker, tap to shorten" : "FST, tap to expand"}>
      <span key={run} className={motion ? fx : ""} style={{ display: "inline-block" }}>
        {open ? (
          <span className="pc-name" style={{ fontSize: 13.5, lineHeight: 1.04, display: "block" }}>
            Friendship<br />Tracker
          </span>
        ) : (
          <span className="pc-name" style={{ fontSize: 25, lineHeight: 1.12, display: "block" }}>
            FST
          </span>
        )}
      </span>
    </button>
  );
}

/* ================================================================== */
/*  the first run walkthrough                                          */
/* ================================================================== */

/* device local on purpose. whether you have seen the tour is about this
   phone, not about you, so it stays out of the synced state */
const TOUR_KEY = "panelcount:tour:v1";

const tourSeen = () => {
  try { return localStorage.getItem(TOUR_KEY) === "done"; } catch (e) { return true; }
};
const markTourSeen = () => {
  try { localStorage.setItem(TOUR_KEY, "done"); } catch (e) { /* nothing to do */ }
};

const TOUR_STEPS = [
  {
    title: "Here is the shape of it",
    body: "Pages hold people, each person gets a panel, and you tap plus on a panel when you spend real time with someone. A minute and you will have the whole thing. Start by making a page.",
  },
  {
    title: "Now add a person",
    body: "One is enough to start. Pick whoever you have been meaning to message back. The panel that appears is theirs, and you can make it look like them later.",
  },
  {
    title: "Tap + when you see them",
    body: "That is the whole job. Minus takes back a tap you did not mean. The big number is this period, and it starts again from zero every week until you change that in Settings. The all time total never resets.",
  },
  {
    title: "The dashboard reads it back",
    body: "It is up in the corner. Six ways to draw the same counts, and the gap between the person you see most and the person you see least.",
  },
  {
    title: "One last thing",
    body: "This lives on your device and works with no internet at all. Clearing your browser wipes it, so save a backup from Settings, or switch on sync and it keeps a copy in your own Google Drive.",
  },
];

function Tour({ step, onNext, onSkip }) {
  const last = step === TOUR_STEPS.length - 1;
  const { title, body } = TOUR_STEPS[step];

  /* it sits under the app rather than over it, so it never covers the thing
     it is asking you to tap */
  return (
    <div style={{
      flexShrink: 0, borderTop: `3px solid ${INK}`, background: INK,
      display: "flex", justifyContent: "center", padding: "3px 3px max(3px, env(safe-area-inset-bottom))",
    }}>
      <div role="dialog" aria-label="Getting started" style={{
        width: "100%", maxWidth: 560, background: PAPER, padding: "13px 15px 14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div className="pc-name" style={{ fontSize: 26, lineHeight: 1.05 }}>{title}</div>
          <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>{step + 1} of {TOUR_STEPS.length}</span>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "7px 0 13px" }}>{body}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <InkButton small active onClick={onNext}>{last ? "Start counting" : "Next"}</InkButton>
          {!last && <InkButton small onClick={onSkip}>Skip</InkButton>}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  the page strip                                                     */
/* ================================================================== */

function PageStrip({ sections, activeId, onPick, onCreate }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { if (naming) inputRef.current?.focus(); }, [naming]);

  const stop = () => { setNaming(false); setName(""); };
  const make = (e) => { e.preventDefault(); onCreate(name); stop(); };

  return (
    <div style={{ display: "flex", gap: 5, overflowX: "auto", flex: 1, minWidth: 120, alignItems: "center" }}>
      {sections.map((s) => (
        <button key={s.id} type="button" className="pc-btn pc-tab" data-on={s.id === activeId} onClick={() => onPick(s.id)}>
          {s.name}
        </button>
      ))}

      {naming ? (
        <form onSubmit={make} style={{ display: "flex", gap: 5, flexShrink: 0 }}
          /* clicking away drops it, but focus moving to the Add button does not */
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) stop(); }}>
          <input ref={inputRef} className="pc-tab-input" value={name} placeholder="New page"
            aria-label="Name for the new page" onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") stop(); }} />
          <button type="submit" className="pc-btn pc-tab" data-on="true">Add</button>
        </form>
      ) : (
        <button type="button" className="pc-btn pc-tab pc-tab-add" onClick={() => setNaming(true)}
          title="Make a new page" aria-label="Make a new page">+</button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  app                                                                */
/* ================================================================== */

export default function PanelCount() {
  const [state, setState] = useState(null);
  const [view, setView] = useState("panels");
  const [sectionId, setSectionId] = useState(null);
  const [status, setStatus] = useState("Loading");
  const [customId, setCustomId] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);
  const [tour, setTour] = useState(null);
  const tourMark = useRef({ step: -1, sections: 0, people: 0 });
  const saveTimer = useRef(null);
  const importRef = useRef(null);
  const syncer = useSync(state, setState);

  useEffect(() => {
    let alive = true;
    (async () => {
      let loaded = null;
      try {
        const raw = await store.get(STORAGE_KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch (e) { loaded = null; }
      if (!alive) return;
      const fresh = applyDueResets(migrate(loaded));
      setState(fresh);
      setSectionId(fresh.sections[0]?.id || null);
      setStatus("");
      /* anyone who already has something has been using this for a while and
         does not need showing around. mark it seen rather than show it */
      if (!tourSeen()) {
        if (fresh.sections.length || fresh.people.length) markTourSeen();
        else setTour(0);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* the first two steps are things to do, so doing them moves the tour on */
  useEffect(() => {
    if (tour === null || !state) return;
    const mark = tourMark.current;
    if (mark.step !== tour) {
      tourMark.current = { step: tour, sections: state.sections.length, people: state.people.length };
      return;
    }
    if (tour === 0 && state.sections.length > mark.sections) setTour(1);
    if (tour === 1 && state.people.length > mark.people) setTour(2);
  }, [state, tour]);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!state) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await store.set(STORAGE_KEY, JSON.stringify(state));
      if (!ok) { setStatus("Could not save, storage may be full"); setTimeout(() => setStatus(""), 3200); }
    }, 350);
    return () => clearTimeout(saveTimer.current);
  }, [state]);

  const setSettings = useCallback((patch) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch, updatedAt: Date.now() } }));
  }, []);

  const handlers = useMemo(() => ({
    onBump: (id, n) => setState((s) => {
      const person = s.people.find((p) => p.id === id);
      if (!person) return s;
      if (n < 0 && person.count <= 0) return s;
      const event = { id: uid(), p: id, d: n, t: Date.now() };
      return derive({ ...s, events: [...s.events, event] });
    }),
    onEdit: (id, patch) => setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    })),
    onPhoto: async (id, file, key = "photo") => {
      try {
        const img = await shrinkImage(file, key === "banner" ? 1100 : 320);
        setState((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, [key]: img } : p)) }));
      } catch (e) {
        setStatus("That image would not load");
        setTimeout(() => setStatus(""), 2600);
      }
    },
  }), []);

  const actions = {
    addSection: (name) => setState((s) => {
      const id = uid();
      setSectionId(id);
      setView("panels");
      return { ...s, sections: [...s.sections, { id, name: (name || "").trim() || "Friends", updatedAt: Date.now() }] };
    }),
    renameSection: (id, name) => setState((s) => ({
      ...s,
      sections: s.sections.map((x) => (x.id === id ? { ...x, name, updatedAt: Date.now() } : x)),
    })),
    deleteSection: (id) => setState((s) => {
      const t = Date.now();
      const sections = s.sections.filter((x) => x.id !== id);
      const gone = s.people.filter((p) => p.sectionId === id).map((p) => ({ id: p.id, t }));
      if (sectionId === id) setSectionId(sections[0]?.id || null);
      return {
        ...s, sections,
        people: s.people.filter((p) => p.sectionId !== id),
        tombs: [...s.tombs, { id, t }, ...gone],
      };
    }),
    addPerson: (sid, name) => setState((s) => ({
      ...s,
      people: [...s.people, makePerson(sid, (name || "").trim() || "New friend",
        GRADIENT_PRESETS[s.people.length % GRADIENT_PRESETS.length])],
    })),
    deletePerson: (id) => setState((s) => ({
      ...s,
      people: s.people.filter((p) => p.id !== id),
      tombs: [...s.tombs, { id, t: Date.now() }],
    })),
    editPerson: (id, patch) => handlers.onEdit(id, patch),
    zeroPerson: (id) => setState((s) => derive({
      ...s,
      people: s.people.map((p) => p.id !== id ? p : {
        ...p,
        base: { ...(p.base || { allTime: 0, touch: 0 }), count: 0, since: Date.now() },
        updatedAt: Date.now(),
      }),
    })),
    resetNow: () => setState((s) => archivePeriod(s)),
    showTour: () => { setView("panels"); setTour(0); },
    wipe: () => {
      const fresh = defaultState();
      setState(fresh);
      setSectionId(null);
      setView("panels");
      setCustomId(null);
    },
    exportData: () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `panel-count-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    importData: () => importRef.current?.click(),
  };

  const doImport = (file) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const next = migrate(JSON.parse(r.result));
        setState(next);
        setSectionId(next.sections[0]?.id || null);
        setStatus("Backup loaded");
        setTimeout(() => setStatus(""), 2400);
      } catch (e) {
        setStatus("That file is not a Panel Count backup");
        setTimeout(() => setStatus(""), 3000);
      }
    };
    r.readAsText(file);
  };

  const endTour = () => { markTourSeen(); setTour(null); };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

  if (!state) {
    return <div style={{ height: "100vh", display: "grid", placeItems: "center", background: PAPER,
      fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>{status}</div>;
  }

  const activePage = state.sections.find((s) => s.id === sectionId) || state.sections[0] || null;
  const activeId = activePage ? activePage.id : null;
  const people = state.people.filter((p) => p.sectionId === activeId);
  const customPerson = state.people.find((p) => p.id === customId) || null;
  const noPages = state.sections.length === 0;

  return (
    <div className={state.settings.motion ? "" : "pc-still"} style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: PAPER, color: INK,
      fontFamily: "ui-sans-serif, system-ui, 'Segoe UI', sans-serif", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        .pc-name {
          font-family: 'Bebas Neue', Impact, 'Haettenschweiler', 'Arial Narrow Bold', sans-serif;
          letter-spacing: .5px; border: none; background: transparent; outline: none;
        }
        .pc-name:focus { background: rgba(255,255,255,.55); }
        .pc-avatar:focus-visible { outline: 3px solid #38BDF8; outline-offset: 4px; }
        /* one button system for the whole app: ink outline, hard offset
           shadow, and it presses into the page when you tap it. Everything
           clickable uses this rather than growing a look of its own. */
        .pc-btn {
          font: inherit; font-weight: 700; font-size: 13.5px; line-height: 1;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          min-height: 44px; min-width: 44px; padding: 10px 15px;
          border: 3px solid ${INK}; border-radius: 0;
          background: ${PAPER}; color: ${INK}; box-shadow: 4px 4px 0 ${INK};
          cursor: pointer; white-space: nowrap; text-align: center;
          transition: transform 90ms, box-shadow 90ms;
          -webkit-tap-highlight-color: transparent;
        }
        .pc-btn:active { transform: translate(4px,4px); box-shadow: 0 0 0 ${INK}; }
        .pc-btn:focus-visible { outline: 3px solid #38BDF8; outline-offset: 3px; }
        .pc-btn[data-on="true"] { background: ${INK}; color: ${PAPER}; }
        /* danger keeps ink text, since rose on paper is too weak to read */
        .pc-btn[data-danger="true"] { border-color: #F43F5E; box-shadow: 4px 4px 0 #F43F5E; }
        .pc-btn[data-danger="true"]:active { box-shadow: 0 0 0 #F43F5E; }
        .pc-btn[data-danger="true"][data-on="true"] { background: #F43F5E; color: ${INK}; }
        .pc-btn-sm { font-size: 12.5px; padding: 8px 12px; border-width: 2px; box-shadow: 3px 3px 0 ${INK}; }
        .pc-btn-sm:active { transform: translate(3px,3px); }
        .pc-btn-sm[data-danger="true"] { box-shadow: 3px 3px 0 #F43F5E; }
        .pc-round {
          width: 52px; height: 52px; font-size: 27px; padding: 0;
          border-width: 3px; box-shadow: 4px 4px 0 ${INK};
        }
        .pc-round-sm { width: 44px; height: 44px; font-size: 21px; box-shadow: 3px 3px 0 ${INK}; }
        .pc-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 44px; height: 60px; font-size: 22px; padding: 0; z-index: 4;
        }
        .pc-nav:active { transform: translateY(-50%) translate(4px,4px); }
        .pc-corner {
          position: absolute; top: 9px; right: 9px; z-index: 5;
          width: 44px; height: 44px; font-size: 17px; padding: 0;
          box-shadow: 3px 3px 0 ${INK};
        }
        .pc-dot { background: none; border: none; padding: 17px 3px; cursor: pointer; line-height: 0; }
        .pc-dot:focus-visible { outline: 3px solid #38BDF8; outline-offset: 1px; }
        .pc-dot span { display: block; height: 11px; border: 2px solid ${INK}; }
        .pc-swatch { padding: 0; min-width: 0; min-height: 0; width: 74px; height: 46px; box-shadow: none; border-width: 2px; }
        .pc-swatch[data-on="true"] { border-width: 4px; box-shadow: 4px 4px 0 ${INK}; }
        .pc-chip { width: 44px; height: 44px; padding: 10px; background: none; border: none; box-shadow: none; }
        .pc-chip span { display: block; width: 100%; height: 100%; border: 2px solid ${INK}; }
        .pc-select {
          font: inherit; padding: 9px 11px; min-height: 44px; border: 2px solid ${INK};
          background: #fff; color: ${INK}; border-radius: 0;
        }
        .pc-select:focus-visible { outline: 3px solid #38BDF8; outline-offset: 2px; }
        .pc-tab { flex-shrink: 0; }
        .pc-tab-add { font-size: 20px; padding: 10px 14px; }
        .pc-tab-input {
          font: inherit; font-weight: 700; font-size: 13.5px; width: 132px; min-height: 44px;
          padding: 8px 11px; border: 3px dashed ${INK}; background: #fff; color: ${INK}; border-radius: 0;
        }
        /* pressing down is movement, so the animation setting turns it off */
        .pc-still .pc-btn { transition: none; }
        .pc-still .pc-btn:active { transform: none; }
        .pc-still .pc-nav:active { transform: translateY(-50%); }
        .pc-still .pc-pill-dot { animation: none; }
        .pc-field { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
        .pc-field input[type=color] { width: 52px; height: 44px; padding: 0; border: 2px solid ${INK}; background: none; cursor: pointer; }
        .pc-field input[type=color]:focus-visible { outline: 3px solid #38BDF8; outline-offset: 2px; }
        .pc-drawer { position: absolute; inset: 0; z-index: 20; background: rgba(13,13,17,.55); overflow-y: auto; display: flex; justify-content: center; align-items: flex-start; padding: 14px; }
        .pc-drawer-inner { width: 100%; max-width: 620px; background: ${PAPER}; border: 3px solid ${INK}; box-shadow: 10px 10px 0 rgba(0,0,0,.5); padding: 16px; }
        .pc-fx { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 2; }
        .pc-spark, .pc-drift { position: absolute; bottom: -20px; border-radius: 50%; opacity: .75; }
        .pc-spark { animation: pcRise linear infinite; }
        .pc-drift { animation: pcFloat linear infinite; }
        @keyframes pcRise { from { transform: translateY(0) scale(1); opacity: .85; } to { transform: translateY(-115%) scale(.4); opacity: 0; } }
        @keyframes pcFloat { from { transform: translate(0,0); opacity: .5; } 50% { transform: translate(18px,-55%); opacity: .8; } to { transform: translate(-10px,-110%); opacity: 0; } }
        .pc-scan { animation: pcScan 7s linear infinite; }
        @keyframes pcScan { from { background-position: 0 0; } to { background-position: 0 260px; } }
        .pc-speed { animation: pcSpeed 1.1s linear infinite; opacity: .55; }
        @keyframes pcSpeed { from { background-position: 0 0; } to { background-position: 90px 0; } }
        .pc-glitch { position: absolute; inset: 0; mix-blend-mode: multiply; animation: pcGlitch 3.4s steps(2) infinite; }
        .pc-glitch-b { animation-delay: .28s; animation-duration: 2.9s; }
        @keyframes pcGlitch { 0%,88%,100% { opacity: 0; transform: none; } 90% { opacity: .9; transform: translateX(-9px); } 94% { opacity: .7; transform: translateX(7px) skewX(3deg); } }
        @keyframes pcGlow { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.18); } }
        .pc-spin { animation: pcSpin 9s linear infinite; }
        @keyframes pcSpin { to { transform: rotate(360deg); } }
        @keyframes pcBlink { 0%,100% { opacity: 1; } 50% { opacity: .2; } }
        .pc-brand {
          font: inherit; background: none; border: none; padding: 0; margin-right: 6px;
          color: ${INK}; cursor: pointer; text-align: left; min-width: 84px; min-height: 44px;
          perspective: 400px; flex-shrink: 0;
        }
        .pc-brand:focus-visible { outline: 3px solid #38BDF8; outline-offset: 3px; }
        .pc-b-flip { animation: pcBFlip 420ms cubic-bezier(.16,1,.3,1); }
        @keyframes pcBFlip { from { transform: rotateX(90deg); opacity: .1; } to { transform: none; opacity: 1; } }
        .pc-b-tear { animation: pcBTear 380ms cubic-bezier(.16,1,.3,1); }
        @keyframes pcBTear {
          from { clip-path: polygon(0 0, 6% 0, 2% 20%, 7% 40%, 1% 60%, 6% 80%, 2% 100%, 0 100%); }
          to { clip-path: polygon(0 0, 100% 0, 100% 20%, 100% 40%, 100% 60%, 100% 80%, 100% 100%, 0 100%); }
        }
        .pc-b-stamp { animation: pcBStamp 380ms cubic-bezier(.2,1.3,.4,1); }
        @keyframes pcBStamp {
          0% { transform: scale(1.7) rotate(-7deg); opacity: 0; }
          60% { transform: scale(.93) rotate(2deg); opacity: 1; }
          100% { transform: none; }
        }
        .pc-b-slide { animation: pcBSlide 340ms cubic-bezier(.16,1,.3,1); }
        @keyframes pcBSlide { from { transform: translateY(-115%); opacity: 0; } to { transform: none; opacity: 1; } }
        .pc-b-glitch { animation: pcBGlitch 380ms steps(4); }
        @keyframes pcBGlitch {
          0% { transform: translateX(-7px) skewX(-10deg); opacity: .2; }
          40% { transform: translateX(6px) skewX(8deg); opacity: .9; }
          70% { transform: translateX(-3px) skewX(-3deg); }
          100% { transform: none; opacity: 1; }
        }
        .pc-b-type { animation: pcBType 400ms steps(9); }
        @keyframes pcBType { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        @media (prefers-reduced-motion: reduce) {
          .pc-b-flip, .pc-b-tear, .pc-b-stamp, .pc-b-slide, .pc-b-glitch, .pc-b-type { animation: none !important; }
        }
        .pc-tape { position: absolute; width: 52px; height: 20px; background: rgba(255,255,255,.62); border: 1.5px solid rgba(13,13,17,.4); z-index: 3; }
        @keyframes pcPop { 0% { transform: scale(1); } 38% { transform: scale(1.28) rotate(-3deg); } 100% { transform: scale(1); } }
        .pc-pop { animation: pcPop 340ms cubic-bezier(.2,1.4,.4,1); }
        @keyframes pcRip {
          from { clip-path: polygon(0 0, 4% 0, 0 12%, 5% 26%, 0 38%, 6% 52%, 0 64%, 4% 78%, 0 90%, 3% 100%, 0 100%); }
          to { clip-path: polygon(0 0, 100% 0, 100% 12%, 100% 26%, 100% 38%, 100% 52%, 100% 64%, 100% 78%, 100% 90%, 100% 100%, 0 100%); }
        }
        .pc-rip { animation: pcRip 520ms cubic-bezier(.16,1,.3,1); }
        @keyframes pcSlide { from { transform: translateX(46%); opacity: .2; } to { transform: translateX(0); opacity: 1; } }
        .pc-slide { animation: pcSlide 400ms cubic-bezier(.16,1,.3,1); }
        @keyframes pcImpact { 0% { transform: scale(1.3) rotate(4deg); opacity: 0; } 60% { transform: scale(.97) rotate(-1deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
        .pc-impact { animation: pcImpact 380ms cubic-bezier(.2,1.2,.4,1); }
        @media (prefers-reduced-motion: reduce) {
          .pc-pop, .pc-rip, .pc-slide, .pc-impact, .pc-spark, .pc-drift, .pc-scan, .pc-speed, .pc-glitch, .pc-spin { animation: none !important; }
          .pc-pill-dot { animation: none !important; }
          .pc-btn { transition: none; }
          .pc-btn:active { transform: none; }
          .pc-nav:active { transform: translateY(-50%); }
        }
      `}</style>

      <header style={{
        borderBottom: `3px solid ${INK}`, padding: "9px 12px", display: "flex",
        gap: 10, alignItems: "center", flexWrap: "wrap", flexShrink: 0,
        paddingTop: "max(9px, env(safe-area-inset-top))",
      }}>
        <Brand motion={state.settings.motion} />
        <PageStrip sections={state.sections} activeId={activeId}
          onPick={setSectionId} onCreate={actions.addSection} />
        <SyncPill sync={syncer.sync} linked={syncer.linked} onClick={() => { setView("settings"); syncer.run("manual"); }} />
        <div style={{ display: "flex", gap: 5 }}>
          {[["panels", "Panels"], ["dashboard", "Dashboard"], ["settings", "Settings"]].map(([id, label]) => (
            <button key={id} type="button" className="pc-btn pc-tab" data-on={view === id} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
      </header>

      {status && <div style={{ background: INK, color: PAPER, fontSize: 12.5, padding: "5px 12px", flexShrink: 0 }}>{status}</div>}

      <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {view === "panels" && noPages && (
          <PromptCard title="Make your first page"
            blurb="A page is a group of people. Everyone on it gets their own panel to count on. One page is plenty to start with."
            placeholder="Friends" cta="Make the page" onSubmit={actions.addSection} />
        )}
        {view === "panels" && !noPages && (
          <PanelsView people={people} settings={state.settings} handlers={handlers}
            pageName={activePage?.name} onAddPerson={(name) => actions.addPerson(activeId, name)} />
        )}
        {view === "dashboard" && <Dashboard state={state} people={people} setSettings={setSettings} />}
        {view === "settings" && (
          <SettingsView state={state} setSettings={setSettings} actions={actions} sectionId={activeId}
            onCustomize={setCustomId} installPrompt={!!installEvt} onInstall={install} syncer={syncer} />
        )}
        {view !== "panels" && customPerson && (
          <CustomizeDrawer person={customPerson} settings={state.settings} onEdit={handlers.onEdit}
            onPhoto={handlers.onPhoto} onClose={() => setCustomId(null)} />
        )}
      </main>

      {tour !== null && (
        <Tour step={tour} onSkip={endTour}
          onNext={() => (tour + 1 < TOUR_STEPS.length ? setTour(tour + 1) : endTour())} />
      )}

      <input ref={importRef} type="file" accept="application/json" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} />
    </div>
  );
}
