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
