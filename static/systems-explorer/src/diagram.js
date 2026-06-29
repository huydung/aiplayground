import { NS } from "./config.js";
import { clamp, linkById, nodeById } from "./model.js";
import { formatNumber, linkLabel, wrapLabel } from "./text.js";

export function svgEl(tag, attrs = {}, text = null) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== null) el.textContent = text;
  return el;
}

export function renderSvg(ctx) {
  const { els, doc, runtime, state } = ctx;
  els.viewport.innerHTML = "";
  els.viewport.setAttribute("transform", `translate(${state.transform.x} ${state.transform.y}) scale(${state.transform.k})`);
  const linkLayer = svgEl("g");
  const nodeLayer = svgEl("g");
  const packageLayer = svgEl("g");
  els.viewport.append(linkLayer, nodeLayer, packageLayer);
  state.linkRoutes = buildLinkRoutes(doc);
  doc.links.forEach(l => renderLink(ctx, linkLayer, l));
  doc.nodes.forEach(n => renderNode(ctx, nodeLayer, n));
  runtime.packages.forEach(p => renderPackage(ctx, packageLayer, p));
}

function renderLink(ctx, layer, l) {
  const s = nodeById(ctx.doc, l.source);
  const t = nodeById(ctx.doc, l.target);
  if (!s || !t) return;
  const pathData = linkPath(ctx, s, t, l);
  layer.append(svgEl("path", {
    d: pathData.d,
    class: `svg-link ${l.polarity < 0 ? "negative" : ""} ${isSelected(ctx, "link", l.id) ? "selected" : ""}`,
    "marker-end": l.polarity < 0 ? "url(#arrowHeadRed)" : "url(#arrowHead)",
    "data-link": l.id
  }));
  const mid = pointOnPath(pathData, .5);
  const label = linkLabel(l);
  const w = Math.max(54, label.length * 6.6 + 14);
  layer.append(svgEl("rect", { x: mid.x - w / 2, y: mid.y - 13, width: w, height: 26, rx: 6, class: "link-label-bg", "data-link": l.id }));
  layer.append(svgEl("text", { x: mid.x, y: mid.y + 1, class: "link-label", "data-link": l.id }, label));
}

export function linkPath(ctx, s, t, l = null) {
  if (s.id === t.id) {
    const r = nodeRadius() + 16;
    const x = s.x, y = s.y;
    return {
      d: `M ${x + r * .45} ${y - r * .75} C ${x + r * 1.8} ${y - r * 1.95}, ${x + r * 1.95} ${y + r * .75}, ${x + r * .4} ${y + r * .8}`,
      p0: { x: x + r * .45, y: y - r * .75 },
      p1: { x: x + r * 1.8, y: y - r * 1.95 },
      p2: { x: x + r * 1.95, y: y + r * .75 },
      p3: { x: x + r * .4, y: y + r * .8 }
    };
  }
  const route = l && ctx.state.linkRoutes ? ctx.state.linkRoutes.get(l.id) : null;
  return makeLinkPath(s, t, route ? route.offset : linkRoute(ctx.doc, l, s, t).offset);
}

function makeLinkPath(s, t, offset) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / len, y: dx / len };
  const mid = { x: (s.x + t.x) / 2 + normal.x * offset, y: (s.y + t.y) / 2 + normal.y * offset };
  const p0 = boundaryPoint(s, { x: mid.x - s.x, y: mid.y - s.y }, 8);
  const p3 = boundaryPoint(t, { x: mid.x - t.x, y: mid.y - t.y }, 12);
  const p1 = { x: p0.x + (mid.x - p0.x) * .72, y: p0.y + (mid.y - p0.y) * .72 };
  const p2 = { x: p3.x + (mid.x - p3.x) * .72, y: p3.y + (mid.y - p3.y) * .72 };
  return { d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`, p0, p1, p2, p3 };
}

function nodeRadius() { return 68; }

function boundaryPoint(n, vector, pad = 8) {
  const len = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: n.x + vector.x / len * (nodeRadius() + pad),
    y: n.y + vector.y / len * (nodeRadius() + pad)
  };
}

function renderNode(ctx, layer, n) {
  const g = svgEl("g", { class: "node-shell", "data-node": n.id });
  const value = ctx.runtime.getValue(n.id);
  const out = ctx.runtime.outOfRange(n, value);
  if (out) g.classList.add("pulse");
  renderStock(ctx, g, n, value, isSelected(ctx, "node", n.id), out);
  if (shouldShowFireControls(ctx)) renderFireButtons(g, n);
  layer.append(g);
}

function shouldShowFireControls(ctx) {
  return ctx.state.mode === "simulate"
    && ctx.state.armed
    && ctx.state.waitingForFire
    && !ctx.state.running
    && ctx.runtime.packages.length === 0;
}

function renderStock(ctx, g, n, value, selected, out) {
  const w = 138, h = 88, x = n.x - w / 2, y = n.y - h / 2;
  const range = Math.max(1, n.max - n.min);
  g.append(svgEl("rect", { x, y, width: w, height: h, rx: 14, fill: "#fff", stroke: n.color, class: `node-outline ${selected ? "selected" : ""}` }));
  const frac = value >= 0 && n.max !== 0 ? clamp(value / n.max, 0, 1) : 0;
  const fillH = h * frac;
  g.append(svgEl("rect", { x: x + 3, y: y + h - fillH - 3, width: w - 6, height: Math.max(0, fillH), rx: 10, fill: n.color, opacity: .22 }));
  if (n.min < 0) {
    const zeroY = y + h - clamp((0 - n.min) / range, 0, 1) * h;
    g.append(svgEl("line", { x1: x + 10, y1: zeroY, x2: x + w - 10, y2: zeroY, stroke: "#9aa3af", "stroke-dasharray": "3 4", "stroke-width": 1 }));
  }
  if (out) {
    g.append(svgEl("rect", { x: x - 5, y: y - 5, width: w + 10, height: h + 10, rx: 18, fill: "none", stroke: n.color, "stroke-width": 3, opacity: .55 }));
  }
  nodeText(g, n, value);
  flowMarker(g, n);
  g.append(svgEl("rect", { x, y, width: w, height: h, rx: 14, fill: "transparent", class: "node-hit", "data-node": n.id }));
}

function nodeText(g, n, value) {
  const label = wrapLabel(n.label, 18);
  const startY = n.y - (label.length > 1 ? 15 : 10);
  label.forEach((line, i) => g.append(svgEl("text", { x: n.x, y: startY + i * 14, class: "label-text", fill: n.color, "data-node": n.id }, line)));
  g.append(svgEl("text", { x: n.x, y: n.y + 22, class: "value-text", "data-node": n.id }, formatNumber(value)));
}

function flowMarker(g, n) {
  if (!n.flow) return;
  const bits = [];
  if (n.flow.in) bits.push("↗" + n.flow.in.strength);
  if (n.flow.out) bits.push("↘" + n.flow.out.strength);
  if (bits.length) g.append(svgEl("text", { x: n.x, y: n.y - 54, class: "flow-text", fill: n.color, "data-node": n.id }, bits.join("  ")));
}

function renderFireButtons(g, n) {
  const x = n.x + nodeRadius() + 18;
  const up = svgEl("g", { class: "fire-button fire-up", transform: `translate(${x} ${n.y - 17})`, "data-fire": n.id, "data-dir": "1" });
  up.append(svgEl("circle", { r: 14 }));
  up.append(svgEl("text", { y: 1 }, "▲"));
  const down = svgEl("g", { class: "fire-button fire-down", transform: `translate(${x} ${n.y + 17})`, "data-fire": n.id, "data-dir": "-1" });
  down.append(svgEl("circle", { r: 14 }));
  down.append(svgEl("text", { y: 1 }, "▼"));
  g.append(up, down);
}

function renderPackage(ctx, layer, p) {
  const l = linkById(ctx.doc, p.linkId);
  const s = nodeById(ctx.doc, p.fromId);
  const t = nodeById(ctx.doc, p.toId);
  if (!l || !s || !t) return;
  const visualEnd = p.visualArriveTime || p.arriveTime;
  const denom = Math.max(.04, visualEnd - p.departTime);
  const frac = clamp((ctx.runtime.simTime - p.departTime) / denom, 0, 1);
  const pos = pointOnPath(linkPath(ctx, s, t, l), frac);
  const sourceDir = p.polarity < 0 ? -p.dir : p.dir;
  const visualDir = p.polarity < 0 && frac < .5 ? sourceDir : p.dir;
  const g = svgEl("g", { class: `package ${visualDir > 0 ? "up" : "down"}`, transform: `translate(${pos.x} ${pos.y})` });
  const points = visualDir > 0 ? "0,-12 11,10 -11,10" : "0,12 11,-10 -11,-10";
  g.append(svgEl("polygon", { points }));
  layer.append(g);
}

function isSelected(ctx, type, id) {
  return ctx.state.selected && ctx.state.selected.type === type && ctx.state.selected.id === id;
}

function graphCenter(doc) {
  if (!doc.nodes.length) return { x: 0, y: 0 };
  return {
    x: doc.nodes.reduce((sum, n) => sum + n.x, 0) / doc.nodes.length,
    y: doc.nodes.reduce((sum, n) => sum + n.y, 0) / doc.nodes.length
  };
}

function linkRoute(doc, l, s = nodeById(doc, l.source), t = nodeById(doc, l.target)) {
  if (!s || !t) return { offset: 52 };
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / len, y: dx / len };
  const center = graphCenter(doc);
  const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
  const outwardSign = ((mid.x - center.x) * normal.x + (mid.y - center.y) * normal.y) >= 0 ? 1 : -1;
  return { offset: outwardSign * Math.min(96, Math.max(52, len * .16)) };
}

function buildLinkRoutes(doc) {
  const routes = new Map();
  const chosen = [];
  doc.links.forEach(l => {
    const s = nodeById(doc, l.source);
    const t = nodeById(doc, l.target);
    if (!s || !t || s.id === t.id) return;
    const base = linkRoute(doc, l, s, t).offset;
    const candidates = routeCandidates(doc, base, l).map(offset => {
      const path = makeLinkPath(s, t, offset);
      const samples = samplePath(path);
      return { offset, samples, score: routeScore(samples, chosen) };
    });
    candidates.sort((a, b) => b.score - a.score || Math.abs(a.offset) - Math.abs(b.offset));
    routes.set(l.id, { offset: candidates[0].offset });
    chosen.push(candidates[0].samples);
  });
  return routes;
}

function routeCandidates(doc, base, l) {
  const samePair = doc.links.filter(other => {
    if (other.source === other.target || l.source === l.target) return other.id === l.id;
    return (other.source === l.source && other.target === l.target) || (other.source === l.target && other.target === l.source);
  });
  const pairIndex = Math.max(0, samePair.findIndex(other => other.id === l.id));
  const pairShift = (pairIndex - (samePair.length - 1) / 2) * 36;
  const sign = Math.sign(base) || 1;
  return [base + pairShift, base + pairShift + sign * 42, base + pairShift - sign * 42, -base + pairShift, base + pairShift + sign * 78, -base + pairShift - sign * 42];
}

function samplePath(path) {
  const samples = [];
  for (let i = 1; i < 10; i += 1) samples.push(pointOnPath(path, i / 10));
  return samples;
}

function routeScore(samples, chosenGroups) {
  if (!chosenGroups.length) return 999;
  if (chosenGroups.some(group => polylinesIntersect(samples, group))) return -1000;
  let min = Infinity;
  chosenGroups.forEach(group => samples.forEach(a => group.forEach(b => { min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y)); })));
  return min;
}

function polylinesIntersect(a, b) {
  for (let i = 0; i < a.length - 1; i += 1) {
    for (let j = 0; j < b.length - 1; j += 1) {
      if (segmentsIntersect(a[i], a[i + 1], b[j], b[j + 1])) return true;
    }
  }
  return false;
}

function segmentsIntersect(a, b, c, d) {
  const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

export function pointOnPath(pathData, t) {
  const { p0, p1, p2, p3 } = pathData;
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y
  };
}
