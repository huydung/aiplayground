import { GATE_OPTIONS, MIN_DELAY, NODE_COLORS, PAYLOAD_OPTIONS, TRIGGER_OPTIONS } from "./config.js";
import { clamp, enforceNodeBounds, linkById, nodeById } from "./model.js";
import { escapeHtml, formatNumber, linkLabel, ruleLabel, trimNum } from "./text.js";
import { svgEl } from "./diagram.js";

export function renderEditor(ctx) {
  const { els, state } = ctx;
  if (!state.selected) {
    els.editorSubhead.textContent = "Select a node, link, or loop label";
    els.editorBody.innerHTML = `<div class="empty-state"><strong>No selection</strong><span>Choose a node, rule link, or R/B loop label on the canvas.</span><div class="pill-row"><span class="pill">Nodes keep memory</span><span class="pill">Links have rules</span><span class="pill">Packages carry delay</span></div></div>`;
    return;
  }
  if (state.selected.type === "node") renderNodeEditor(ctx, nodeById(ctx.doc, state.selected.id));
  if (state.selected.type === "link") renderLinkEditor(ctx, linkById(ctx.doc, state.selected.id));
  if (state.selected.type === "loop") renderLoopEditor(ctx, ctx.doc.loops.find(loop => loop.id === state.selected.id));
}

function renderNodeEditor(ctx, n) {
  if (!n) return;
  const { els, runtime, saveDoc, renderAll } = ctx;
  els.editorSubhead.textContent = "node";
  els.editorBody.innerHTML = `
    <div class="editor-sections">
      <div class="editor-section-title">Identity</div>
      <div class="field-grid node-identity-grid">
        <label>Name <input id="nodeLabel" value="${escapeHtml(n.label)}"></label>
        <label>Start <input id="nodeValue" type="number" value="${n.value}" step="1"></label>
        <label>Color
          <div class="color-picker" id="nodeColorPicker">
            <button class="color-current" id="nodeColorToggle" type="button" aria-expanded="false">
              <span class="color-current-chip" style="background:${escapeHtml(n.color)}"></span>
              <span>Choose color</span>
            </button>
            <div class="color-swatches" id="nodeColorSwatches">${renderColorSwatches(n.color)}</div>
          </div>
        </label>
      </div>

      <div class="editor-section-title">Bounds</div>
      <div class="bounds-grid">
        <label class="bound-control">Minimum <input id="nodeMin" type="number" value="${n.min}" step="1"></label>
        <label class="bound-control">Maximum <input id="nodeMax" type="number" value="${n.max}" step="1"></label>
        <label class="bound-check"><input id="minStrict" type="checkbox" ${n.minStrict !== false ? "checked" : ""}> Enforce min</label>
        <label class="bound-check"><input id="maxStrict" type="checkbox" ${n.maxStrict !== false ? "checked" : ""}> Enforce max</label>
      </div>

      <div class="editor-section-title">Natural flow</div>
      <div class="flow-matrix">
        <span></span>
        <span class="flow-heading">Strength</span>
        <span class="flow-heading">Delay</span>
        <span class="flow-label">Flow in</span>
        <input id="flowInStrength" type="number" min="0" step="1" value="${n.flow && n.flow.in ? n.flow.in.strength : 0}">
        <input id="flowInDelay" type="number" min="0" step="0.5" value="${n.flow && n.flow.in ? n.flow.in.delay : 1}">
        <span class="flow-label">Flow out</span>
        <input id="flowOutStrength" type="number" min="0" step="1" value="${n.flow && n.flow.out ? n.flow.out.strength : 0}">
        <input id="flowOutDelay" type="number" min="0" step="0.5" value="${n.flow && n.flow.out ? n.flow.out.delay : 1}">
      </div>
    </div>
    <div class="row-actions"><button id="deleteNode" class="btn-danger" type="button">Delete node</button></div>
  `;
  const update = (redraw = false) => {
    n.label = document.getElementById("nodeLabel").value || "Node";
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
    if (!ctx.state.started) runtime.setValue(n.id, n.value);
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
  const source = nodeById(doc, l.source)?.label || "Missing source";
  const target = nodeById(doc, l.target)?.label || "Missing target";
  els.editorBody.innerHTML = `
    <div class="field-grid">
      <div class="field-block readonly-field"><span>From</span><strong>${escapeHtml(source)}</strong></div>
      <div class="field-block readonly-field"><span>To</span><strong>${escapeHtml(target)}</strong></div>
      <label>Polarity <select id="linkPolarity"><option value="1">same (s)</option><option value="-1">opposite (o)</option></select></label>
      <label>Trigger <select id="linkTrigger">${TRIGGER_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label>
      <label>Gate <select id="linkGate">${GATE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label>
      <label>Threshold <input id="linkGateValue" type="number" step="1" value="${l.gateValue || 0}"></label>
      <label>Payload <select id="linkMode">${PAYLOAD_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label>
      <label>Amount <input id="linkAmount" type="number" min="0" step="1" value="${payloadAmount(l)}"></label>
      <label>Delay <input id="linkDelay" type="number" min="0" step="0.5" value="${l.delay}"></label>
    </div>
    <div class="pill-row" style="margin-top:10px"><span class="pill">${escapeHtml(linkLabel(l))}</span></div>
    <div class="row-actions"><button id="deleteLink" class="btn-danger" type="button">Delete link</button></div>
  `;
  document.getElementById("linkPolarity").value = String(l.polarity);
  document.getElementById("linkTrigger").value = l.trigger;
  document.getElementById("linkGate").value = l.gate;
  document.getElementById("linkMode").value = l.mode;
  const update = (redraw = false) => {
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
  ["linkPolarity", "linkTrigger", "linkGate", "linkMode"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => update(true));
  });
  ["linkGateValue", "linkAmount", "linkDelay"].forEach(id => {
    bindDraftInput(id, () => update(false), () => update(true));
  });
  document.getElementById("deleteLink").addEventListener("click", () => ctx.deleteLink(l.id));
}

function renderLoopEditor(ctx, loop) {
  if (!loop) return;
  const { els, saveDoc, renderAll } = ctx;
  els.editorSubhead.textContent = "loop label";
  els.editorBody.innerHTML = `
    <div class="editor-sections">
      <div class="editor-section-title">Loop label</div>
      <div class="field-grid">
        <label>Type
          <select id="loopType">
            <option value="R">R · Reinforcing</option>
            <option value="B">B · Balancing</option>
          </select>
        </label>
        <label class="field-full">Title <input id="loopTitle" value="${escapeHtml(loop.title)}" maxlength="80"></label>
        <label>X <input id="loopX" type="number" value="${Math.round(loop.x)}" step="1"></label>
        <label>Y <input id="loopY" type="number" value="${Math.round(loop.y)}" step="1"></label>
      </div>
      <div class="pill-row"><span class="pill">${loop.type === "B" ? "Balancing loop" : "Reinforcing loop"}</span><span class="pill">Tooltip: ${escapeHtml(loop.title)}</span></div>
    </div>
    <div class="row-actions"><button id="deleteLoop" class="btn-danger" type="button">Delete loop label</button></div>
  `;
  document.getElementById("loopType").value = loop.type;
  const update = (redraw = false) => {
    loop.type = document.getElementById("loopType").value === "B" ? "B" : "R";
    loop.title = (document.getElementById("loopTitle").value || (loop.type === "B" ? "Balancing loop" : "Reinforcing loop")).slice(0, 80);
    loop.x = readNumber("loopX", loop.x);
    loop.y = readNumber("loopY", loop.y);
    saveDoc();
    if (redraw) renderAll();
  };
  document.getElementById("loopType").addEventListener("change", () => update(true));
  ["loopTitle", "loopX", "loopY"].forEach(id => bindDraftInput(id, () => update(false), () => update(true)));
  document.getElementById("deleteLoop").addEventListener("click", () => ctx.deleteLoop(loop.id));
}

function payloadAmount(l) {
  if (Number.isFinite(Number(l.amount))) return Number(l.amount);
  if (l.mode === "prop") return Math.max(0, Number(l.frac || 0) * 100);
  if (l.mode === "delta") return 100;
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
  const { els } = ctx;
  if (ctx.state.behaviorView === "chart") {
    drawChart(ctx, els.chart, els.chart.clientWidth || 340, 200);
  }
  if (els.chartLightbox && els.chartLightbox.classList.contains("open")) {
    const rect = els.expandedChart.getBoundingClientRect();
    drawChart(ctx, els.expandedChart, Math.max(640, rect.width || 900), Math.max(360, rect.height || 520));
  }
}

function drawChart(ctx, svg, w, h) {
  const { doc, runtime } = ctx;
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.innerHTML = "";
  const colors = chartColors();
  const legend = layoutLegend(doc.nodes, w, h);
  const pad = { l: 34, r: 12, t: 18 + legend.height, b: 26 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  svg.append(svgEl("rect", { x: 0, y: 0, width: w, height: h, fill: colors.bg, rx: 7 }));
  renderChartLegend(svg, legend, colors);
  svg.append(svgEl("line", { x1: pad.l, y1: h - pad.b, x2: w - pad.r, y2: h - pad.b, stroke: colors.axis }));
  svg.append(svgEl("line", { x1: pad.l, y1: pad.t, x2: pad.l, y2: h - pad.b, stroke: colors.axis }));
  if (runtime.history.length < 2) {
    svg.append(svgEl("text", { x: w / 2, y: h / 2, "text-anchor": "middle", fill: colors.text, "font-size": 12, "font-weight": 700 }, "Start the simulation to draw behavior over time."));
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
    svg.append(svgEl("line", { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: colors.grid }));
    svg.append(svgEl("text", { x: pad.l - 8, y: y + 4, "text-anchor": "end", fill: colors.text, "font-size": 10 }, formatNumber(v)));
  });
  doc.nodes.forEach(n => {
    const points = runtime.history.map(row => `${xFor(row.t)},${yFor(row.values[n.id] ?? 0)}`).join(" ");
    svg.append(svgEl("polyline", { points, fill: "none", stroke: n.color, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  });
}

function layoutLegend(nodes, chartWidth, chartHeight) {
  if (!nodes.length) return { rows: [], height: 0 };
  const rows = [[]];
  const maxWidth = Math.max(120, chartWidth - 24);
  const maxRows = chartHeight < 260 ? 3 : 8;
  let hiddenCount = 0;
  let rowWidth = 0;
  nodes.forEach(n => {
    if (rows.length > maxRows) {
      hiddenCount += 1;
      return;
    }
    const label = trimLegendLabel(n.label || "Node");
    const itemWidth = Math.min(160, 30 + label.length * 6.3);
    if (rowWidth > 0 && rowWidth + itemWidth + 14 > maxWidth) {
      if (rows.length >= maxRows) {
        hiddenCount += 1;
        return;
      }
      rows.push([]);
      rowWidth = 0;
    }
    rows[rows.length - 1].push({ label, color: n.color, width: itemWidth, x: rowWidth });
    rowWidth += itemWidth + 14;
  });
  if (hiddenCount > 0) {
    const lastRow = rows[rows.length - 1];
    const x = lastRow.length ? lastRow[lastRow.length - 1].x + lastRow[lastRow.length - 1].width + 14 : 0;
    lastRow.push({ label: "+" + hiddenCount + " more", color: "var(--chart-text)", width: 70, x });
  }
  return { rows, height: rows.length ? rows.length * 17 + 5 : 0 };
}

function renderChartLegend(svg, legend, colors) {
  legend.rows.forEach((row, rowIndex) => {
    row.forEach(item => {
      const x = 12 + item.x;
      const y = 13 + rowIndex * 17;
      svg.append(svgEl("line", {
        x1: x,
        y1: y,
        x2: x + 18,
        y2: y,
        stroke: item.color,
        "stroke-width": 3,
        "stroke-linecap": "round"
      }));
      svg.append(svgEl("text", {
        x: x + 24,
        y: y + 4,
        fill: colors.label,
        "font-size": 10,
        "font-weight": 760
      }, item.label));
    });
  });
}

function trimLegendLabel(label) {
  return label.length > 22 ? label.slice(0, 21) + "..." : label;
}

function chartColors() {
  const styles = getComputedStyle(document.body);
  return {
    bg: styles.getPropertyValue("--chart-bg").trim() || "#fff",
    grid: styles.getPropertyValue("--chart-grid").trim() || "#edf0f4",
    axis: styles.getPropertyValue("--chart-axis").trim() || "#cbd3dd",
    text: styles.getPropertyValue("--chart-text").trim() || "#69717d",
    label: styles.getPropertyValue("--chart-label").trim() || "#303744"
  };
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
