import { GATE_OPTIONS, MIN_DELAY, NODE_COLORS, PAYLOAD_OPTIONS, TRIGGER_OPTIONS } from "./config.js";

export function stock(id, label, min, max, value, x, y, color, flow = { in: null, out: null }) {
  return { id, label, kind: "stock", min, max, value, x, y, color, minStrict: true, maxStrict: true, flow };
}

export function link(
  id,
  source,
  target,
  polarity,
  mode,
  strength,
  frac,
  delay,
  trigger = "any",
  gate = "always",
  gateValue = 0
) {
  const defaultMode = "delta";
  const amount = 100;
  return {
    id,
    source,
    target,
    polarity,
    mode: defaultMode,
    amount,
    strength: amount,
    frac: 1,
    delay,
    trigger: "any",
    gate: "always",
    gateValue: 0
  };
}

export function baseDoc(nodes, links) {
  return { version: 5, nextId: 20, nodes, links };
}

export const archetypes = [
  {
    key: "fixes",
    title: "Fixes That Fail",
    desc: "Overtime closes a milestone gap only while the gap is positive; delayed burnout reopens it later.",
    doc: () => baseDoc([
      stock("gap", "Gap to Milestone", -50, 100, 80, 210, 250, "#bd0129"),
      stock("ot", "Overtime", 0, 100, 20, 520, 210, "#f59e0b"),
      stock("bo", "Burnout", 0, 100, 20, 520, 470, "#7c3aed", { out: { strength: 2, delay: 2 }, in: null })
    ], [
      link("l1", "gap", "ot", 1, "fixed", 6, .4, 1, "increase", "above", 0),
      link("l2", "ot", "gap", -1, "fixed", 6, .4, 1, "increase", "above", 0),
      link("l3", "ot", "bo", 1, "fixed", 5, .4, 1, "increase", "above", 0),
      link("l4", "bo", "gap", 1, "fixed", 5, .4, 3, "increase", "above", 0)
    ])
  },
  {
    key: "burden",
    title: "Shifting the Burden",
    desc: "A fast workaround relieves pressure while capability weakens through delayed side effects.",
    doc: () => baseDoc([
      stock("pressure", "Production Pressure", 0, 100, 64, 200, 260, "#bd0129"),
      stock("fix", "Heroic Workaround", 0, 100, 20, 500, 175, "#f59e0b"),
      stock("cap", "Process Capability", 0, 100, 56, 500, 430, "#168b5a"),
      stock("dep", "Dependency Risk", -50, 100, 0, 760, 310, "#2366d1")
    ], [
      link("b1", "pressure", "fix", 1, "fixed", 5, .3, 1, "increase", "above", 0),
      link("b2", "fix", "pressure", -1, "fixed", 6, .3, 1, "increase", "above", 0),
      link("b3", "fix", "dep", 1, "prop", 3, .35, 0, "increase", "above", 0),
      link("b4", "dep", "cap", -1, "fixed", 5, .35, 2, "increase", "above", 0),
      link("b5", "cap", "pressure", -1, "fixed", 4, .25, 1, "increase", "above", 0)
    ])
  },
  {
    key: "limits",
    title: "Limits to Success",
    desc: "A winning production pattern grows until capacity constraints push back.",
    doc: () => baseDoc([
      stock("quality", "Feature Quality", 0, 100, 34, 210, 240, "#168b5a"),
      stock("scope", "Player Excitement", 0, 100, 42, 500, 185, "#2366d1"),
      stock("capacity", "Team Capacity", 0, 100, 72, 520, 445, "#f59e0b"),
      stock("load", "Coordination Load", -50, 100, 0, 780, 320, "#bd0129")
    ], [
      link("c1", "quality", "scope", 1, "fixed", 4, .3, 1, "increase", "above", 0),
      link("c2", "scope", "quality", 1, "fixed", 3, .3, 1, "increase", "above", 0),
      link("c3", "scope", "load", 1, "prop", 3, .35, 0, "increase", "above", 0),
      link("c4", "load", "capacity", -1, "fixed", 5, .35, 2, "increase", "above", 0),
      link("c5", "capacity", "quality", 1, "fixed", 4, .25, 1, "increase", "above", 0)
    ])
  },
  {
    key: "escalation",
    title: "Escalation",
    desc: "Two teams answer each other's intensity until both burn attention.",
    doc: () => baseDoc([
      stock("a", "Team A Urgency", 0, 100, 32, 245, 250, "#bd0129"),
      stock("b", "Team B Urgency", 0, 100, 32, 650, 250, "#2366d1"),
      stock("cost", "Coordination Cost", 0, 100, 12, 450, 470, "#f59e0b")
    ], [
      link("e1", "a", "b", 1, "fixed", 5, .4, 1, "increase", "above", 0),
      link("e2", "b", "a", 1, "fixed", 5, .4, 1, "increase", "above", 0),
      link("e3", "a", "cost", 1, "fixed", 3, .3, 1.5, "increase", "above", 0),
      link("e4", "b", "cost", 1, "fixed", 3, .3, 1.5, "increase", "above", 0)
    ])
  }
];

export function cleanDoc(doc) {
  return {
    version: 5,
    nextId: doc.nextId || 1,
    nodes: doc.nodes.map(n => ({
      id: n.id,
      label: n.label,
      kind: "stock",
      min: Number(n.min),
      max: Number(n.max),
      value: Number(n.value),
      x: Number(n.x),
      y: Number(n.y),
      color: n.color || "#bd0129",
      minStrict: n.minStrict !== false,
      maxStrict: n.maxStrict !== false,
      flow: {
        in: n.flow && n.flow.in ? { strength: Number(n.flow.in.strength) || 0, delay: Number(n.flow.in.delay) || 1 } : null,
        out: n.flow && n.flow.out ? { strength: Number(n.flow.out.strength) || 0, delay: Number(n.flow.out.delay) || 1 } : null
      }
    })),
    links: doc.links.map(cleanLink)
  };
}

export function sanitizeDoc(doc) {
  doc.version = 5;
  doc.nextId = doc.nextId || 1;
  doc.nodes.forEach((n, i) => {
    n.id ||= "n" + (i + 1);
    n.kind = "stock";
    n.label ||= "Stock " + (i + 1);
    n.min = Number.isFinite(Number(n.min)) ? Number(n.min) : 0;
    n.max = Number.isFinite(Number(n.max)) ? Number(n.max) : 100;
    if (n.max === n.min) n.max = n.min + 100;
    n.x = Number(n.x) || 220 + i * 120;
    n.y = Number(n.y) || 260;
    n.color ||= NODE_COLORS[i % NODE_COLORS.length];
    const legacyStrict = n.flowClamp !== false;
    n.minStrict = n.minStrict === undefined ? legacyStrict : n.minStrict !== false;
    n.maxStrict = n.maxStrict === undefined ? legacyStrict : n.maxStrict !== false;
    n.value = enforceNodeBounds(n, Number(n.value) || 0);
    n.flow ||= { in: null, out: null };
    n.flow.in = n.flow.in && Number(n.flow.in.strength) > 0
      ? { strength: Number(n.flow.in.strength), delay: Math.max(MIN_DELAY, Number(n.flow.in.delay) || 1) }
      : null;
    n.flow.out = n.flow.out && Number(n.flow.out.strength) > 0
      ? { strength: Number(n.flow.out.strength), delay: Math.max(MIN_DELAY, Number(n.flow.out.delay) || 1) }
      : null;
  });
  doc.links = doc.links.filter(l => doc.nodes.some(n => n.id === l.source) && doc.nodes.some(n => n.id === l.target));
  doc.links.forEach((l, i) => Object.assign(l, cleanLink({ ...l, id: l.id || "l" + (i + 1) })));
}

function cleanLink(l) {
  const triggerValues = new Set(TRIGGER_OPTIONS.map(o => o.value));
  const gateValues = new Set(GATE_OPTIONS.map(o => o.value));
  const mode = normalizePayloadMode(l.mode);
  const amount = normalizePayloadAmount({ ...l, mode });
  return {
    id: l.id,
    source: l.source,
    target: l.target,
    polarity: Number(l.polarity) === -1 ? -1 : 1,
    mode,
    amount,
    strength: clamp(Number(l.strength ?? amount) || 1, 1, 999),
    frac: Math.max(0, Number(l.frac ?? amount / 100) || 1),
    delay: Math.max(0, Number(l.delay) || 0),
    trigger: triggerValues.has(l.trigger) ? l.trigger : "any",
    gate: normalizeGate(l.gate, gateValues),
    gateValue: normalizeGateValue(l)
  };
}

function normalizePayloadMode(mode) {
  return PAYLOAD_OPTIONS.some(o => o.value === mode) ? mode : "delta";
}

function normalizePayloadAmount(l) {
  if (Number.isFinite(Number(l.amount))) return Math.max(0, Number(l.amount));
  if (l.mode === "prop") return Math.max(0, Number(l.frac || 1) * 100);
  if (l.mode === "delta") return 100;
  return Math.max(0, Number(l.strength || 1));
}

function normalizeGate(gate, gateValues) {
  if (gate === "positive") return "above";
  if (gate === "negative") return "below";
  return gateValues.has(gate) ? gate : "always";
}

function normalizeGateValue(l) {
  if (Number.isFinite(Number(l.gateValue))) return Number(l.gateValue);
  if (l.gate === "positive" || l.gate === "negative") return 0;
  return 0;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function enforceNodeBounds(n, value) {
  let next = Number(value) || 0;
  if (n.minStrict !== false) next = Math.max(n.min, next);
  if (n.maxStrict !== false) next = Math.min(n.max, next);
  return next;
}

export function nodeById(doc, id) {
  return doc.nodes.find(n => n.id === id);
}

export function linkById(doc, id) {
  return doc.links.find(l => l.id === id);
}
