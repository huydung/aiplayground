import { GATE_OPTIONS, TRIGGER_OPTIONS } from "./config.js";

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

export function trimNum(v) {
  return Number(v).toFixed(2).replace(/\.?0+$/, "");
}

export function formatNumber(v) {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : trimNum(v);
}

export function linkLabel(l) {
  const relation = l.polarity > 0 ? "(s)" : "(o)";
  const amount = Number(l.amount ?? (l.mode === "prop" ? l.frac * 100 : l.strength)) || 0;
  const core = l.mode === "fixed"
    ? `${l.polarity > 0 ? "+" : "-"}${trimNum(amount)}`
    : `${trimNum(amount)}% ${l.mode === "delta" ? "delta" : "source"}`;
  const delay = l.delay ? ` t${trimNum(l.delay)}` : "";
  return `${relation} ${core}${delay} | ${ruleLabel(l)}`;
}

export function ruleLabel(l) {
  const trigger = TRIGGER_OPTIONS.find(o => o.value === l.trigger)?.short || "chg";
  const gate = GATE_OPTIONS.find(o => o.value === l.gate)?.short || "always";
  if (l.gate === "above" || l.gate === "below") return `${trigger} & ${gate}${trimNum(l.gateValue || 0)}`;
  return gate === "always" ? trigger : `${trigger} & ${gate}`;
}

export function wrapLabel(label, max) {
  const words = String(label).split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(word => {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 2);
}
