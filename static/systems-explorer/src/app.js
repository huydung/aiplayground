import { NODE_COLORS } from "./config.js";
import { archetypes, baseDoc, clamp, cleanDoc, link, nodeById, sanitizeDoc, stock } from "./model.js";
import { createRuntime } from "./simulation.js";
import { exportDoc, loadStoredDoc, saveDoc as persistDoc } from "./storage.js";
import { renderSvg } from "./diagram.js";
import { renderBehavior, renderEditor, setBehaviorView } from "./panels.js";
import { escapeHtml } from "./text.js";

const els = {
  body: document.body,
  workspace: document.getElementById("workspace"),
  diagram: document.getElementById("diagram"),
  viewport: document.getElementById("viewport"),
  editorBody: document.getElementById("editorBody"),
  editorSubhead: document.getElementById("editorSubhead"),
  chart: document.getElementById("historyChart"),
  stepTable: document.getElementById("stepTable"),
  chartPane: document.getElementById("chartPane"),
  tablePane: document.getElementById("tablePane"),
  chartTabBtn: document.getElementById("chartTabBtn"),
  tableTabBtn: document.getElementById("tableTabBtn"),
  time: document.getElementById("timeReadout"),
  packages: document.getElementById("packageReadout"),
  statusText: document.getElementById("statusText"),
  continueBtn: document.getElementById("continueBtn"),
  toast: document.getElementById("toast"),
  examplesModal: document.getElementById("examplesModal"),
  exampleGrid: document.getElementById("exampleGrid"),
  importFile: document.getElementById("importFile"),
  chartPanel: document.getElementById("chartPanel"),
  chartBackdrop: document.getElementById("chartBackdrop")
};

const state = {
  doc: null,
  runtime: null,
  mode: "configure",
  selected: null,
  linkDraft: null,
  running: false,
  armed: false,
  waitingForFire: false,
  lastFrame: null,
  stepTarget: null,
  checkpoints: [],
  speed: 1.4,
  behaviorView: "chart",
  transform: { x: 80, y: 70, k: 1 },
  drag: null,
  panelDrag: null,
  linkRoutes: new Map()
};

init();

function init() {
  state.doc = loadStoredDoc() || archetypes[0].doc();
  sanitizeDoc(state.doc);
  state.runtime = createRuntime(state.doc);
  bindUi();
  renderExamples();
  renderAll();
  requestAnimationFrame(tick);
}

function ctx() {
  return {
    els,
    state,
    doc: state.doc,
    runtime: state.runtime,
    saveDoc,
    renderAll,
    deleteNode,
    deleteLink
  };
}

function bindUi() {
  document.getElementById("configureMode").addEventListener("click", () => setMode("configure"));
  document.getElementById("simulateMode").addEventListener("click", () => setMode("simulate"));
  document.getElementById("examplesBtn").addEventListener("click", () => els.examplesModal.classList.add("open"));
  document.getElementById("closeExamplesBtn").addEventListener("click", () => els.examplesModal.classList.remove("open"));
  els.examplesModal.addEventListener("click", e => { if (e.target === els.examplesModal) els.examplesModal.classList.remove("open"); });
  document.getElementById("newBtn").addEventListener("click", newDiagram);
  document.getElementById("importBtn").addEventListener("click", () => els.importFile.click());
  document.getElementById("exportBtn").addEventListener("click", () => exportDoc(state.doc));
  document.getElementById("addStockBtn").addEventListener("click", addStock);
  document.getElementById("addLinkBtn").addEventListener("click", startLinkMode);
  document.getElementById("backBtn").addEventListener("click", stepBack);
  document.getElementById("stepBtn").addEventListener("click", () => {
    if (state.mode !== "simulate") setMode("simulate");
    startStepForward();
  });
  document.getElementById("pauseBtn").addEventListener("click", togglePause);
  document.getElementById("resetBtn").addEventListener("click", () => {
    resetRuntime();
    if (state.mode === "simulate") armSimulation(true);
    setStatus("<strong>Reset:</strong> values, packages, and history are back at t = 0.");
    renderAll();
  });
  document.getElementById("speed").addEventListener("input", e => { state.speed = Number(e.target.value); });
  els.continueBtn.addEventListener("click", continueRun);
  document.getElementById("expandChartBtn").addEventListener("click", () => toggleChartExpanded());
  els.chartBackdrop.addEventListener("click", () => toggleChartExpanded(false));
  els.chartTabBtn.addEventListener("click", () => setBehaviorView(ctx(), "chart"));
  els.tableTabBtn.addEventListener("click", () => setBehaviorView(ctx(), "table"));
  els.importFile.addEventListener("change", importDoc);

  els.diagram.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  els.diagram.addEventListener("wheel", onWheel, { passive: false });
  els.diagram.addEventListener("click", onSvgClick);

  document.querySelectorAll("[data-drag-panel]").forEach(head => {
    head.addEventListener("pointerdown", e => {
      if (e.target.closest("button")) return;
      if (state.mode === "simulate") return;
      const panel = document.getElementById(head.dataset.dragPanel);
      state.panelDrag = { panel, dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
      head.setPointerCapture(e.pointerId);
    });
  });
}

function setMode(mode) {
  state.mode = mode;
  els.body.dataset.mode = mode;
  document.getElementById("configureMode").classList.toggle("active", mode === "configure");
  document.getElementById("simulateMode").classList.toggle("active", mode === "simulate");
  state.drag = null;
  state.linkDraft = null;
  if (mode === "configure") {
    resetRuntime();
    toggleChartExpanded(false);
    setStatus("<strong>Configure:</strong> drag stocks, add links, or edit the selected rule.");
  } else {
    armSimulation();
    setStatus("<strong>Simulate:</strong> fire a stock with its green or red control, or step the model forward/back.");
  }
  renderAll();
}

function renderAll() {
  renderSvg(ctx());
  renderEditor(ctx());
  renderBehavior(ctx());
  els.time.textContent = state.runtime.simTime.toFixed(1);
  els.packages.textContent = String(state.runtime.packages.length);
  updateRunControls();
}

function saveDoc() {
  persistDoc(state.doc);
}

function resetRuntime() {
  state.runtime = createRuntime(state.doc);
  state.running = false;
  state.armed = false;
  state.waitingForFire = false;
  state.lastFrame = null;
  state.stepTarget = null;
  state.checkpoints = [];
}

function armSimulation(resetTimeline = false) {
  state.selected = null;
  state.running = false;
  state.armed = true;
  state.waitingForFire = true;
  state.lastFrame = null;
  state.stepTarget = null;
  if (resetTimeline || !state.checkpoints.length) pushCheckpoint();
}

function addStock() {
  const next = state.doc.nextId++;
  const id = "n" + next;
  const center = screenCenterInCanvas();
  state.doc.nodes.push(stock(id, "Stock " + next, 0, 100, 50, center.x, center.y, NODE_COLORS[next % NODE_COLORS.length]));
  state.selected = { type: "node", id };
  resetRuntime();
  saveDoc();
  setStatus("<strong>Stock added:</strong> edit its range, color, and natural flow in the Editor.");
  renderAll();
}

function startLinkMode() {
  state.linkDraft = { source: null };
  setStatus("<strong>Link mode:</strong> click a source stock, then a target stock. The link editor controls when that rule can fire.");
}

function handleLinkNodeClick(id) {
  if (!state.linkDraft.source) {
    state.linkDraft.source = id;
    setStatus(`<strong>Link mode:</strong> source is ${escapeHtml(nodeById(state.doc, id).label)}. Now click the target stock.`);
    return;
  }
  const linkId = "l" + (state.doc.nextId++);
  state.doc.links.push(link(linkId, state.linkDraft.source, id, 1, "fixed", 3, .3, 1, "any", "always"));
  state.selected = { type: "link", id: linkId };
  state.linkDraft = null;
  saveDoc();
  setStatus("<strong>Rule link added:</strong> set trigger, gate, polarity, payload, and delay in the Editor.");
  renderAll();
}

function deleteNode(id) {
  state.doc.nodes = state.doc.nodes.filter(n => n.id !== id);
  state.doc.links = state.doc.links.filter(l => l.source !== id && l.target !== id);
  state.runtime.packages = state.runtime.packages.filter(p => p.fromId !== id && p.toId !== id);
  state.selected = null;
  resetRuntime();
  saveDoc();
  renderAll();
}

function deleteLink(id) {
  state.doc.links = state.doc.links.filter(l => l.id !== id);
  state.runtime.packages = state.runtime.packages.filter(p => p.linkId !== id);
  state.selected = null;
  saveDoc();
  renderAll();
}

function newDiagram() {
  state.doc = baseDoc([
    stock("seed", "Starting Stock", 0, 100, 50, 320, 280, "#bd0129")
  ], []);
  resetRuntime();
  state.selected = { type: "node", id: "seed" };
  saveDoc();
  setStatus("<strong>New diagram:</strong> add stocks and rule links from the Configure toolbar.");
  renderAll();
}

function importDoc(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const doc = JSON.parse(reader.result);
      sanitizeDoc(doc);
      state.doc = doc;
      state.selected = null;
      resetRuntime();
      saveDoc();
      setStatus("<strong>Imported:</strong> diagram loaded.");
      renderAll();
    } catch (err) {
      showToast("Could not import JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function renderExamples() {
  els.exampleGrid.innerHTML = "";
  archetypes.forEach(ex => {
    const btn = document.createElement("button");
    btn.className = "example-card";
    btn.type = "button";
    btn.innerHTML = `<h3>${escapeHtml(ex.title)}</h3><p>${escapeHtml(ex.desc)}</p>`;
    btn.addEventListener("click", () => {
      state.doc = ex.doc();
      sanitizeDoc(state.doc);
      state.selected = null;
      resetRuntime();
      saveDoc();
      els.examplesModal.classList.remove("open");
      setStatus(`<strong>${escapeHtml(ex.title)}:</strong> loaded as a tunable starting point.`);
      renderAll();
    });
    els.exampleGrid.append(btn);
  });
}

function continueRun() {
  state.runtime.pausedForBreak = false;
  state.armed = true;
  els.continueBtn.style.display = "none";
  startStepForward();
}

function togglePause() {
  if (state.mode !== "simulate") setMode("simulate");
  if (state.running) {
    state.running = false;
    setStatus(`<strong>Paused:</strong> t = ${state.runtime.simTime.toFixed(1)}. Resume or step/back manually.`);
  } else if (state.stepTarget != null) {
    state.running = true;
    state.lastFrame = null;
    setStatus(`<strong>Resumed:</strong> continuing to t = ${state.stepTarget}.`);
  } else {
    return;
  }
  renderAll();
}

function startStepForward(captureCurrent = true) {
  if (state.running) return;
  if (captureCurrent) ensureCheckpoint();
  state.runtime.pausedForBreak = false;
  state.stepTarget = Math.floor(state.runtime.simTime) + 1;
  state.running = true;
  state.armed = true;
  state.waitingForFire = false;
  state.lastFrame = null;
  setStatus(`<strong>Step:</strong> advancing to t = ${state.stepTarget}.`);
  renderAll();
}

function completeStep() {
  state.running = false;
  state.stepTarget = null;
  state.armed = true;
  state.waitingForFire = true;
  state.lastFrame = null;
  pushCheckpoint();
  if (state.runtime.pausedForBreak) {
    setStatus("<strong>Paused:</strong> package activity exceeded the safety cap.");
  } else {
    setStatus(`<strong>Step complete:</strong> t = ${Math.floor(state.runtime.simTime)}. Fire a stock or step again.`);
  }
}

function stepBack() {
  if (state.mode !== "simulate") setMode("simulate");
  state.running = false;
  state.stepTarget = null;
  if (state.checkpoints.length > 1) state.checkpoints.pop();
  if (state.checkpoints.length) restoreRuntimeSnapshot(state.checkpoints[state.checkpoints.length - 1]);
  state.armed = true;
  state.waitingForFire = true;
  state.lastFrame = null;
  setStatus(`<strong>Back:</strong> restored t = ${Math.floor(state.runtime.simTime)}.`);
  renderAll();
}

function ensureCheckpoint() {
  if (!state.checkpoints.length) pushCheckpoint();
}

function pushCheckpoint() {
  const snapshot = captureRuntimeSnapshot();
  const last = state.checkpoints[state.checkpoints.length - 1];
  if (last && sameCheckpoint(last, snapshot)) {
    state.checkpoints[state.checkpoints.length - 1] = snapshot;
  } else {
    state.checkpoints.push(snapshot);
  }
  if (state.checkpoints.length > 120) state.checkpoints.shift();
}

function sameCheckpoint(a, b) {
  return Math.abs(a.simTime - b.simTime) < 0.0001
    && a.packages.length === b.packages.length
    && a.packageEvents.length === b.packageEvents.length;
}

function captureRuntimeSnapshot() {
  const r = state.runtime;
  return {
    values: Array.from(r.values.entries()),
    nextFlow: Array.from(r.nextFlow.entries()),
    packages: clone(r.packages),
    simTime: r.simTime,
    history: clone(r.history),
    packageEvents: clone(r.packageEvents),
    lastEventIndex: r.lastEventIndex,
    lastSample: r.lastSample,
    currentOut: Array.from(r.currentOut),
    brokenEver: Array.from(r.brokenEver),
    pausedForBreak: r.pausedForBreak
  };
}

function restoreRuntimeSnapshot(snapshot) {
  const r = state.runtime;
  r.values = new Map(snapshot.values);
  r.nextFlow = new Map(snapshot.nextFlow);
  r.packages = clone(snapshot.packages);
  r.simTime = snapshot.simTime;
  r.history = clone(snapshot.history);
  r.packageEvents = clone(snapshot.packageEvents);
  r.lastEventIndex = snapshot.lastEventIndex;
  r.lastSample = snapshot.lastSample;
  r.currentOut = new Set(snapshot.currentOut);
  r.brokenEver = new Set(snapshot.brokenEver);
  r.pausedForBreak = snapshot.pausedForBreak;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateRunControls() {
  const pauseBtn = document.getElementById("pauseBtn");
  if (!pauseBtn) return;
  pauseBtn.textContent = state.running ? "Pause" : state.stepTarget != null ? "Resume" : "Pause";
  pauseBtn.disabled = state.mode !== "simulate" || (!state.running && state.stepTarget == null);
}

function tick(now) {
  if (state.running && !state.runtime.pausedForBreak) {
    if (state.lastFrame == null) state.lastFrame = now;
    const dt = Math.min(.25, (now - state.lastFrame) / 1000) * state.speed;
    state.lastFrame = now;
    if (state.stepTarget != null) {
      state.runtime.advance(Math.min(dt, Math.max(0, state.stepTarget - state.runtime.simTime)));
      if (state.runtime.simTime >= state.stepTarget - 0.0001 || state.runtime.pausedForBreak) completeStep();
    } else {
      state.runtime.advance(dt);
    }
    renderAll();
  }
  requestAnimationFrame(tick);
}

function onPointerDown(e) {
  const fire = e.target.closest("[data-fire]");
  if (fire) {
    e.stopPropagation();
    ensureCheckpoint();
    state.armed = true;
    state.waitingForFire = false;
    state.runtime.pausedForBreak = false;
    state.lastFrame = null;
    state.runtime.fireNode(fire.dataset.fire, Number(fire.dataset.dir));
    setStatus(`<strong>Fired ${escapeHtml(nodeById(state.doc, fire.dataset.fire).label)}:</strong> eligible rule links sent packages.`);
    startStepForward(false);
    renderAll();
    return;
  }
  const nodeEl = e.target.closest("[data-node]");
  const linkEl = e.target.closest("[data-link]");
  if (state.mode === "simulate") return;
  if (nodeEl) {
    const id = nodeEl.dataset.node;
    if (state.linkDraft) {
      handleLinkNodeClick(id);
      return;
    }
    state.selected = { type: "node", id };
    const p = canvasPoint(e);
    const n = nodeById(state.doc, id);
    state.drag = { type: "node", id, dx: p.x - n.x, dy: p.y - n.y };
    els.diagram.setPointerCapture(e.pointerId);
    renderAll();
  } else if (linkEl) {
    state.selected = { type: "link", id: linkEl.dataset.link };
    renderAll();
  } else {
    const p = canvasPoint(e, false);
    state.selected = null;
    state.drag = { type: "pan", sx: p.x, sy: p.y, ox: state.transform.x, oy: state.transform.y };
    els.diagram.classList.add("dragging");
    renderAll();
  }
}

function onPointerMove(e) {
  if (state.panelDrag) {
    const panel = state.panelDrag.panel;
    panel.style.left = clamp(e.clientX - state.panelDrag.dx, 8, window.innerWidth - panel.offsetWidth - 8) + "px";
    panel.style.top = clamp(e.clientY - state.panelDrag.dy, 76, window.innerHeight - panel.offsetHeight - 8) + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    return;
  }
  if (!state.drag) return;
  if (state.drag.type === "node") {
    const p = canvasPoint(e);
    const n = nodeById(state.doc, state.drag.id);
    n.x = p.x - state.drag.dx;
    n.y = p.y - state.drag.dy;
    saveDoc();
    renderAll();
  } else if (state.drag.type === "pan") {
    const p = canvasPoint(e, false);
    state.transform.x = state.drag.ox + (p.x - state.drag.sx);
    state.transform.y = state.drag.oy + (p.y - state.drag.sy);
    renderAll();
  }
}

function onPointerUp() {
  state.drag = null;
  state.panelDrag = null;
  els.diagram.classList.remove("dragging");
}

function onSvgClick(e) {
  if (e.target === els.diagram && state.linkDraft) {
    state.linkDraft = null;
    setStatus("<strong>Link cancelled:</strong> choose + Link again to create a rule link.");
  }
}

function onWheel(e) {
  if (state.mode === "simulate") return;
  e.preventDefault();
  const rect = els.diagram.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const before = { x: (mx - state.transform.x) / state.transform.k, y: (my - state.transform.y) / state.transform.k };
  const scale = e.deltaY > 0 ? .92 : 1.08;
  state.transform.k = clamp(state.transform.k * scale, .35, 2.8);
  state.transform.x = mx - before.x * state.transform.k;
  state.transform.y = my - before.y * state.transform.k;
  renderAll();
}

function canvasPoint(e, transformed = true) {
  const rect = els.diagram.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (!transformed) return { x, y };
  return { x: (x - state.transform.x) / state.transform.k, y: (y - state.transform.y) / state.transform.k };
}

function screenCenterInCanvas() {
  const rect = els.diagram.getBoundingClientRect();
  return { x: (rect.width / 2 - state.transform.x) / state.transform.k, y: (rect.height / 2 - state.transform.y) / state.transform.k };
}

function setStatus(html) {
  els.statusText.innerHTML = html;
  if (!state.runtime.pausedForBreak) els.continueBtn.style.display = "none";
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3600);
}

function toggleChartExpanded(force) {
  const shouldExpand = typeof force === "boolean" ? force : !els.chartPanel.classList.contains("expanded");
  els.chartPanel.classList.toggle("expanded", shouldExpand);
  els.body.classList.toggle("chart-expanded", shouldExpand);
  document.getElementById("expandChartBtn").textContent = shouldExpand ? "x" : "⤢";
  renderBehavior(ctx());
}

window.SystemsExplorer = {
  get state() { return state; },
  get doc() { return cleanDoc(state.doc); },
  fire: (id, dir = 1) => { state.runtime.fireNode(id, dir); renderAll(); },
  step: (dt = 1) => { state.runtime.advance(dt); renderAll(); }
};
