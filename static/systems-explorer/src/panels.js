import { GATE_OPTIONS, MIN_DELAY, NODE_COLORS, PAYLOAD_OPTIONS, TRIGGER_OPTIONS } from "./config.js";
import { clamp, enforceNodeBounds, linkById, nodeById } from "./model.js";
import { escapeHtml, formatNumber, linkLabel, ruleLabel, trimNum } from "./text.js";
import { svgEl } from "./diagram.js";

export function renderEditor(ctx) {
  const { els, state } = ctx;
  if (state.mode !== "configure") return;
  if (!state.selected) {
    els.editorSubhead.textContent = "Select a stock or link";
    els.editorBody.innerHTML = `<div class="empty-state"><strong>No selection</strong><span>Choose a stock or rule link on the canvas.</span><div class="pill-row"><span class="pill">Stocks keep memory</span><span class="pill">Links have rules</span><span class="pill">Packages carry delay</span></div></div>`;
    return;
  }
  if (state.selected.type === "node") renderNodeEditor(ctx, nodeById(ctx.doc, state.selected.id));
  if (state.selected.type === "link") renderLinkEditor(ctx, linkById(ctx.doc, state.selected.id));
}

function renderNodeEditor(ctx, n) {
  if (!n) return;
  const { els, runtime, saveDoc, renderAll } = ctx;
  els.editorSubhead.textContent = "stock";
  els.editorBody.innerHTML = `
    <div class="field-grid">
      <label>Name <input id="nodeLabel" value="${escapeHtml(n.label)}"></label>
      <label>Color
        <div class="color-picker" id="nodeColorPicker">
          <button class="color-current" id="nodeColorToggle" type="button" aria-expanded="false">
            <span class="color-current-chip" style="background:${escapeHtml(n.color)}"></span>
            <span>Choose color</span>
          </button>
          <div class="color-swatches" id="nodeColorSwatches">${renderColorSwatches(n.color)}</div>
        </div>
      </label>
      <label>Start value <input id="nodeValue" type="number" value="${n.value}" step="1"></label>
      <div class="field-block bound-field">
        <div class="field-title-row">
          <label for="nodeMin">Min</label>
          <label class="strict-toggle"><input id="minStrict" type="checkbox" ${n.minStrict !== false ? "checked" : ""}> Strict enforce</label>
        </div>
        <input id="nodeMin" type="number" value="${n.min}" step="1">
      </div>
      <div class="field-block bound-field">
        <div class="field-title-row">
          <label for="nodeMax">Max</label>
          <label class="strict-toggle"><input id="maxStrict" type="checkbox" ${n.maxStrict !== false ? "checked" : ""}> Strict enforce</label>
        </div>
        <input id="nodeMax" type="number" value="${n.max}" step="1">
      </div>
      <div class="flow-row field-full">
        <span class="flow-row-title">Flow in</span>
        <label>Strength <input id="flowInStrength" type="number" min="0" step="1" value="${n.flow && n.flow.in ? n.flow.in.strength : 0}"></label>
        <label>Delay <input id="flowInDelay" type="number" min="0" step="0.5" value="${n.flow && n.flow.in ? n.flow.in.delay : 1}"></label>
      </div>
      <div class="flow-row field-full">
        <span class="flow-row-title">Flow out</span>
        <label>Strength <input id="flowOutStrength" type="number" min="0" step="1" value="${n.flow && n.flow.out ? n.flow.out.strength : 0}"></label>
        <label>Delay <input id="flowOutDelay" type="number" min="0" step="0.5" value="${n.flow && n.flow.out ? n.flow.out.delay : 1}"></label>
      </div>
    </div>
    <div class="row-actions"><button id="deleteNode" class="btn-danger" type="button">Delete stock</button></div>
  `;
  const update = (redraw = false) => {
    n.label = document.getElementById("nodeLabel").value || "Stock";
    n.min = readNumber("nodeMin", n.min);
    n.max = readNumber("nodeMax", n.max);
    if (n.max <= n.min) n.max = n.min + 1;
    n.minStrict = document.getElementById("minStrict").checked;
    n.maxStrict = document.getElementById("maxStrict").checked;
    n.value = enforceNodeBounds(n, readNumber("nodeValue", n.value));
    const inStrength = readNumber("flowInStrength", n.flow?.in?.strength || 0);
    const outStrength = readNumber("flowOutStrength", n.flow?.out?.strength || 0);
    n.flow = {
      in: inStrength > 0 ? { strength: inStrength, delay: Math.max(MIN_DELAY, readNumber("flowInDelay", n.flow?.in?.delay || 1)) } : null,
      out: outStrength > 0 ? { strength: outStrength, delay: Math.max(MIN_DELAY, readNumber("flowOutDelay", n.flow?.out?.delay || 1)) } : null
    };
    if (!ctx.state.running) runtime.setValue(n.id, n.value);
    saveDoc();
    if (redraw) renderAll();
  };
  ["nodeLabel", "nodeMin", "nodeMax", "nodeValue", "flowInStrength", "flowInDelay", "flowOutStrength", "flowOutDelay"].forEach(id => {
    bindDraftInput(id, () => update(false), () => update(true));
  });
  ["minStrict", "maxStrict"].forEach(id => document.getElementById(id).addEventListener("change", () => update(true)));
  document.getElementById("nodeColorToggle").addEventListener("click", () => {
    const picker = document.getElementById("nodeColorPicker");
    const open = !picker.classList.contains("open");
    picker.classList.toggle("open", open);
    document.getElementById("nodeColorToggle").setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("#nodeColorSwatches .color-swatch").forEach(btn => {
    btn.addEventListener("click", () => {
      n.color = btn.dataset.color;
      saveDoc();
      renderAll();
    });
  });
  document.getElementById("deleteNode").addEventListener("click", () => ctx.deleteNode(n.id));
}

function renderColorSwatches(selectedColor) {
  const current = String(selectedColor || "").toLowerCase();
  return NODE_COLORS.map(color => {
    const selected = color.toLowerCase() === current ? " selected" : "";
    return `<button class="color-swatch${selected}" type="button" data-color="${color}" style="background:${color}" aria-label="Use ${color}"></button>`;
  }).join("");
}

function renderLinkEditor(ctx, l) {
  if (!l) return;
  const { doc, els, saveDoc, renderAll } = ctx;
  els.editorSubhead.textContent = "rule link";
  const nodeOptions = doc.nodes.map(n => `<option value="${n.id}">${escapeHtml(n.label)}</option>`).join("");
  els.editorBody.innerHTML = `
    <div class="field-grid">
      <label>From <select id="linkSource">${nodeOptions}</select></label>
      <label>To <select id="linkTarget">${nodeOptions}</select></label>
      <label>Polarity <select id="linkPolarity"><option value="1">same (s)</option><option value="-1">opposite (o)</option></select></label>
      <label>When source change <select id="linkTrigger">${TRIGGER_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label>
      <label>Only while source <select id="linkGate">${GATE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label>
      <label>Threshold <input id="linkGateValue" type="number" step="1" value="${l.gateValue || 0}"></label>
      <label>Payload <select id="linkMode">${PAYLOAD_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label>
      <label>Amount <input id="linkAmount" type="number" min="0" step="1" value="${payloadAmount(l)}"></label>
      <label>Delay <input id="linkDelay" type="number" min="0" step="0.5" value="${l.delay}"></label>
    </div>
    <div class="pill-row" style="margin-top:10px"><span class="pill">${escapeHtml(linkLabel(l))}</span></div>
    <div class="row-actions"><button id="deleteLink" class="btn-danger" type="button">Delete link</button></div>
  `;
  document.getElementById("linkSource").value = l.source;
  document.getElementById("linkTarget").value = l.target;
  document.getElementById("linkPolarity").value = String(l.polarity);
  document.getElementById("linkTrigger").value = l.trigger;
  document.getElementById("linkGate").value = l.gate;
  document.getElementById("linkMode").value = l.mode;
  const update = (redraw = false) => {
    l.source = document.getElementById("linkSource").value;
    l.target = document.getElementById("linkTarget").value;
    l.polarity = Number(document.getElementById("linkPolarity").value) === -1 ? -1 : 1;
    l.trigger = document.getElementById("linkTrigger").value;
    l.gate = document.getElementById("linkGate").value;
    l.gateValue = readNumber("linkGateValue", l.gateValue || 0);
    l.mode = document.getElementById("linkMode").value;
    l.amount = Math.max(0, readNumber("linkAmount", l.amount || 0));
    l.strength = clamp(l.amount || 1, 1, 999);
    l.frac = l.amount / 100;
    l.delay = Math.max(0, readNumber("linkDelay", l.delay || 0));
    saveDoc();
    if (redraw) renderAll();
  };
  ["linkSource", "linkTarget", "linkPolarity", "linkTrigger", "linkGate", "linkMode"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => update(true));
  });
  ["linkGateValue", "linkAmount", "linkDelay"].forEach(id => {
    bindDraftInput(id, () => update(false), () => update(true));
  });
  document.getElementById("deleteLink").addEventListener("click", () => ctx.deleteLink(l.id));
}

function payloadAmount(l) {
  if (Number.isFinite(Number(l.amount))) return Number(l.amount);
  if (l.mode === "prop") return Math.max(0, Number(l.frac || 0) * 100);
  return Math.max(0, Number(l.strength || 0));
}

function bindDraftInput(id, onInput, onCommit) {
  const el = document.getElementById(id);
  el.addEventListener("input", onInput);
  el.addEventListener("change", onCommit);
}

function readNumber(id, fallback) {
  const value = document.getElementById(id).value;
  return Number.isFinite(Number(value)) && value !== "" ? Number(value) : fallback;
}

export function renderBehavior(ctx) {
  renderBehaviorTabs(ctx);
  renderStepTable(ctx);
  renderChart(ctx);
}

export function setBehaviorView(ctx, view) {
  ctx.state.behaviorView = view;
  renderBehavior(ctx);
}

function renderBehaviorTabs(ctx) {
  const isChart = ctx.state.behaviorView === "chart";
  ctx.els.chartTabBtn.classList.toggle("active", isChart);
  ctx.els.tableTabBtn.classList.toggle("active", !isChart);
  ctx.els.chartPane.classList.toggle("active", isChart);
  ctx.els.tablePane.classList.toggle("active", !isChart);
}

function renderChart(ctx) {
  const { els, doc, runtime } = ctx;
  if (ctx.state.behaviorView !== "chart" && !els.chartPanel.classList.contains("expanded")) return;
  const w = els.chart.clientWidth || 380;
  const h = els.chartPanel.classList.contains("expanded") ? Math.max(240, els.chartPanel.clientHeight - 88) : 200;
  els.chart.setAttribute("width", w);
  els.chart.setAttribute("height", h);
  els.chart.innerHTML = "";
  const pad = { l: 34, r: 12, t: 18, b: 26 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  els.chart.append(svgEl("rect", { x: 0, y: 0, width: w, height: h, fill: "#fff", rx: 7 }));
  els.chart.append(svgEl("line", { x1: pad.l, y1: h - pad.b, x2: w - pad.r, y2: h - pad.b, stroke: "#cbd3dd" }));
  els.chart.append(svgEl("line", { x1: pad.l, y1: pad.t, x2: pad.l, y2: h - pad.b, stroke: "#cbd3dd" }));
  if (runtime.history.length < 2) {
    els.chart.append(svgEl("text", { x: w / 2, y: h / 2, "text-anchor": "middle", fill: "#69717d", "font-size": 12, "font-weight": 700 }, "Start the simulation to draw behavior over time."));
    return;
  }
  const maxT = Math.max(1, runtime.history[runtime.history.length - 1].t);
  let minV = Infinity, maxV = -Infinity;
  runtime.history.forEach(row => Object.values(row.values).forEach(v => { minV = Math.min(minV, v); maxV = Math.max(maxV, v); }));
  if (minV === maxV) { minV -= 10; maxV += 10; }
  const yFor = v => pad.t + (maxV - v) / (maxV - minV) * plotH;
  const xFor = t => pad.l + t / maxT * plotW;
  [minV, 0, maxV].forEach(v => {
    const y = yFor(v);
    if (y < pad.t || y > h - pad.b) return;
    els.chart.append(svgEl("line", { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: "#edf0f4" }));
    els.chart.append(svgEl("text", { x: pad.l - 8, y: y + 4, "text-anchor": "end", fill: "#69717d", "font-size": 10 }, formatNumber(v)));
  });
  doc.nodes.forEach(n => {
    const points = runtime.history.map(row => `${xFor(row.t)},${yFor(row.values[n.id] ?? 0)}`).join(" ");
    els.chart.append(svgEl("polyline", { points, fill: "none", stroke: n.color, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  });
}

function renderStepTable(ctx) {
  const { els, doc, runtime } = ctx;
  const nodeHeaders = doc.nodes.map(n => `<th>${escapeHtml(n.label)}</th>`).join("");
  const linkHeaders = doc.links.map(l => `<th>${escapeHtml(linkColumnName(doc, l))}<br><span class="empty-row">${escapeHtml(ruleLabel(l))}</span></th>`).join("");
  if (!runtime.history.length) {
    els.stepTable.innerHTML = `<thead><tr><th>Step</th>${nodeHeaders}${linkHeaders}</tr></thead><tbody><tr><td class="empty-row" colspan="${doc.nodes.length + doc.links.length + 1}">Start the simulation to record values and link-specific package sends.</td></tr></tbody>`;
    return;
  }
  const rows = runtime.history.slice(-36).map(row => {
    const values = doc.nodes.map(n => `<td>${formatNumber(row.values[n.id] ?? 0)}</td>`).join("");
    const linkCells = doc.links.map(l => {
      const events = row.linkEvents && row.linkEvents[l.id] ? row.linkEvents[l.id] : [];
      const html = events.length
        ? events.map(e => `${e.dir > 0 ? "▲" : "▼"} ${formatNumber(e.amount)} <span class="empty-row">t${trimNum(e.delay)}</span>`).join("<br>")
        : `<span class="empty-row">none</span>`;
      return `<td class="link-event">${html}</td>`;
    }).join("");
    return `<tr><td>${Math.floor(row.t)}</td>${values}${linkCells}</tr>`;
  }).join("");
  els.stepTable.innerHTML = `<thead><tr><th>Step</th>${nodeHeaders}${linkHeaders}</tr></thead><tbody>${rows}</tbody>`;
}

function linkColumnName(doc, l) {
  const source = nodeById(doc, l.source)?.label || "source";
  const target = nodeById(doc, l.target)?.label || "target";
  return `${source} -> ${target}`;
}
