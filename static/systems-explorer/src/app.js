import { NODE_COLORS } from "./config.js";
import { assessBoundaries, currentMaxNodeIds } from "./boundaries.js";
import { fallbackExample, loadExamples } from "./examples.js";
import { baseDoc, clamp, cleanDoc, link, nodeById, sanitizeDoc, stock } from "./model.js";
import { createRuntime } from "./simulation.js";
import {
  activateDiagram,
  activeDiagram,
  createDiagram,
  deleteDiagram as deleteStoredDiagram,
  diagramName,
  exportDiagramLibrary,
  importDiagrams,
  loadDiagramLibrary,
  saveActiveDiagram
} from "./storage.js";
import { renderSvg } from "./diagram.js";
import { renderBehavior, renderEditor, setBehaviorView } from "./panels.js";
import { escapeHtml } from "./text.js";

const THEME_KEY = "hdi-systems-explorer-theme";

const els = {
  body: document.body,
  workspace: document.getElementById("workspace"),
  diagram: document.getElementById("diagram"),
  viewport: document.getElementById("viewport"),
  editorPanel: document.getElementById("editorPanel"),
  editorBody: document.getElementById("editorBody"),
  editorSubhead: document.getElementById("editorSubhead"),
  behaviorSection: document.getElementById("behaviorSection"),
  chart: document.getElementById("historyChart"),
  expandedChart: document.getElementById("expandedHistoryChart"),
  stepTable: document.getElementById("stepTable"),
  chartPane: document.getElementById("chartPane"),
  chartLightbox: document.getElementById("chartLightbox"),
  tablePane: document.getElementById("tablePane"),
  chartTabBtn: document.getElementById("chartTabBtn"),
  tableTabBtn: document.getElementById("tableTabBtn"),
  time: document.getElementById("timeReadout"),
  packages: document.getElementById("packageReadout"),
  step: document.getElementById("stepReadout"),
  currentStepLabel: document.getElementById("currentStepLabel"),
  runStateBadge: document.getElementById("runStateBadge"),
  statusText: document.getElementById("statusText"),
  continueBtn: document.getElementById("continueBtn"),
  toast: document.getElementById("toast"),
  themeToggle: document.getElementById("themeToggle"),
  diagramsModal: document.getElementById("diagramsModal"),
  diagramNameInput: document.getElementById("diagramNameInput"),
  diagramList: document.getElementById("diagramList"),
  examplesModal: document.getElementById("examplesModal"),
  exampleGrid: document.getElementById("exampleGrid"),
  importFile: document.getElementById("importFile"),
  chartPanel: document.getElementById("simulatorPanel"),
  chartBackdrop: document.getElementById("chartBackdrop"),
  closeChartBtn: document.getElementById("closeChartBtn"),
  startModal: document.getElementById("startModal"),
  startNodeSelect: document.getElementById("startNodeSelect"),
  startAmountInput: document.getElementById("startAmountInput"),
  stepMode: document.getElementById("stepMode"),
  speedRow: document.getElementById("speedRow"),
  stepRow: document.getElementById("stepRow")
};

const state = {
  doc: null,
  runtime: null,
  mode: "work",
  selected: null,
  linkDraft: null,
  running: false,
  started: false,
  ended: false,
  armed: false,
  waitingForFire: false,
  lastFrame: null,
  stepTarget: null,
  checkpoints: [],
  speed: 1.4,
  stepByStep: false,
  behaviorView: "chart",
  transform: { x: 430, y: 70, k: 1 },
  drag: null,
  panelDrag: null,
  linkRoutes: new Map(),
  maxPausedNodes: new Set(),
  theme: "light",
  library: null,
  examples: [fallbackExample]
};

init();

async function init() {
  state.theme = loadTheme();
  applyTheme();
  state.examples = await loadExamples();
  state.library = loadDiagramLibrary(state.examples[0].doc(), state.examples[0].title);
  state.doc = activeDiagram(state.library).doc;
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
  document.getElementById("diagramsBtn").addEventListener("click", openDiagramsModal);
  document.getElementById("closeDiagramsBtn").addEventListener("click", closeDiagramsModal);
  els.diagramsModal.addEventListener("click", e => { if (e.target === els.diagramsModal) closeDiagramsModal(); });
  document.getElementById("saveDiagramBtn").addEventListener("click", saveNamedDiagram);
  document.getElementById("saveAsDiagramBtn").addEventListener("click", saveAsNewDiagram);
  document.getElementById("importLibraryBtn").addEventListener("click", () => {
    if (blockSimulationEdit()) return;
    els.importFile.click();
  });
  document.getElementById("exportLibraryBtn").addEventListener("click", exportLibrary);
  document.getElementById("examplesBtn").addEventListener("click", () => {
    if (blockSimulationEdit()) return;
    els.examplesModal.classList.add("open");
  });
  document.getElementById("closeExamplesBtn").addEventListener("click", () => els.examplesModal.classList.remove("open"));
  els.examplesModal.addEventListener("click", e => { if (e.target === els.examplesModal) els.examplesModal.classList.remove("open"); });
  document.getElementById("newBtn").addEventListener("click", newDiagram);
  document.getElementById("importBtn").addEventListener("click", () => {
    if (blockSimulationEdit()) return;
    els.importFile.click();
  });
  document.getElementById("exportBtn").addEventListener("click", exportLibrary);
  els.themeToggle.addEventListener("click", toggleTheme);
  document.getElementById("addStockBtn").addEventListener("click", addStock);
  document.getElementById("addLinkBtn").addEventListener("click", startLinkMode);
  document.getElementById("startRunBtn").addEventListener("click", openStartDialog);
  document.getElementById("stopBtn").addEventListener("click", stopSimulation);
  document.getElementById("prevStepBtn").addEventListener("click", stepBack);
  document.getElementById("nextStepBtn").addEventListener("click", startStepForward);
  document.getElementById("pauseBtn").addEventListener("click", togglePause);
  document.getElementById("resetBtn").addEventListener("click", () => {
    resetRuntime();
    setStatus("<strong>Reset:</strong> values, packages, and history are back at t = 0.");
    renderAll();
  });
  document.getElementById("speed").addEventListener("input", e => { state.speed = Number(e.target.value); });
  els.stepMode.addEventListener("change", () => {
    state.stepByStep = els.stepMode.checked;
    if (state.running && state.stepByStep && state.stepTarget == null) {
      state.running = false;
      setStatus("<strong>Step-by-step:</strong> paused. Use Next and Prev to inspect the run.");
    }
    updateRunControls();
  });
  document.getElementById("confirmStartBtn").addEventListener("click", startFromDialog);
  document.getElementById("cancelStartBtn").addEventListener("click", closeStartDialog);
  document.getElementById("cancelStartFooterBtn").addEventListener("click", closeStartDialog);
  els.startModal.addEventListener("click", e => { if (e.target === els.startModal) closeStartDialog(); });
  els.continueBtn.addEventListener("click", continueRun);
  els.chartTabBtn.addEventListener("click", () => setBehaviorView(ctx(), "chart"));
  els.tableTabBtn.addEventListener("click", () => setBehaviorView(ctx(), "table"));
  els.chartPane.addEventListener("click", () => {
    if (state.behaviorView === "chart" && !els.chartLightbox.classList.contains("open")) toggleChartExpanded(true);
  });
  els.closeChartBtn.addEventListener("click", () => toggleChartExpanded(false));
  els.chartBackdrop.addEventListener("click", () => toggleChartExpanded(false));
  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && els.chartLightbox.classList.contains("open")) toggleChartExpanded(false);
    if (handleSimulationShortcut(e)) return;
  });
  els.importFile.addEventListener("change", importDoc);

  els.diagram.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  els.diagram.addEventListener("wheel", onWheel, { passive: false });
  els.diagram.addEventListener("click", onSvgClick);
}

function renderAll() {
  if (state.started) {
    state.selected = null;
    state.linkDraft = null;
    state.drag = null;
  }
  syncPanelVisibility();
  renderSvg(ctx());
  renderEditor(ctx());
  renderBehavior(ctx());
  els.time.textContent = state.runtime.simTime.toFixed(1);
  els.packages.textContent = String(state.runtime.packages.length);
  els.step.textContent = String(Math.floor(state.runtime.simTime));
  els.currentStepLabel.textContent = "Step " + Math.floor(state.runtime.simTime);
  updateRunControls();
}

function saveDoc() {
  saveActiveDiagram(state.library, state.doc);
  renderDiagramLibrary();
}

function openDiagramsModal() {
  if (blockSimulationEdit()) return;
  els.diagramsModal.classList.add("open");
  renderDiagramLibrary();
  setTimeout(() => els.diagramNameInput.focus(), 0);
}

function closeDiagramsModal() {
  els.diagramsModal.classList.remove("open");
}

function saveNamedDiagram() {
  const name = els.diagramNameInput.value;
  saveActiveDiagram(state.library, state.doc, name);
  setStatus(`<strong>Saved:</strong> ${escapeHtml(diagramName(state.library))}.`);
  renderDiagramLibrary();
}

function saveAsNewDiagram() {
  if (blockSimulationEdit()) return;
  const record = createDiagram(state.library, copyName(els.diagramNameInput.value || diagramName(state.library)), state.doc);
  state.doc = record.doc;
  state.selected = null;
  resetRuntime();
  setStatus(`<strong>Saved as new:</strong> ${escapeHtml(record.name)}.`);
  renderAll();
  renderDiagramLibrary();
}

function loadDiagramRecord(id) {
  if (blockSimulationEdit()) return;
  saveActiveDiagram(state.library, state.doc);
  const record = activateDiagram(state.library, id);
  if (!record) return;
  state.doc = record.doc;
  sanitizeDoc(state.doc);
  state.selected = null;
  resetRuntime();
  setStatus(`<strong>Loaded:</strong> ${escapeHtml(record.name)}.`);
  renderAll();
  renderDiagramLibrary();
}

function removeDiagramRecord(id) {
  if (blockSimulationEdit()) return;
  const record = state.library.diagrams.find(d => d.id === id);
  if (!record || !confirm(`Delete "${record.name}"?`)) return;
  const active = deleteStoredDiagram(state.library, id, baseDoc([
    stock("seed", "Starting Stock", 0, 100, 50, 320, 280, "#bd0129")
  ], []));
  state.doc = active.doc;
  sanitizeDoc(state.doc);
  state.selected = null;
  resetRuntime();
  setStatus(`<strong>Deleted:</strong> ${escapeHtml(record.name)}.`);
  renderAll();
  renderDiagramLibrary();
}

function exportLibrary() {
  saveActiveDiagram(state.library, state.doc);
  exportDiagramLibrary(state.library);
}

function renderDiagramLibrary() {
  if (!els.diagramNameInput || !state.library) return;
  const active = activeDiagram(state.library);
  els.diagramNameInput.value = active ? active.name : "";
  if (!els.diagramsModal.classList.contains("open")) return;
  els.diagramList.innerHTML = state.library.diagrams.map(d => `
    <div class="diagram-list-item ${d.id === state.library.activeId ? "active" : ""}">
      <div>
        <strong>${escapeHtml(d.name)}</strong>
        <span>${escapeHtml(formatDate(d.updatedAt))}</span>
      </div>
      <div class="diagram-item-actions">
        <button type="button" data-load-diagram="${escapeHtml(d.id)}" ${d.id === state.library.activeId || state.started ? "disabled" : ""}>Load</button>
        <button type="button" class="btn-danger" data-delete-diagram="${escapeHtml(d.id)}" ${state.started ? "disabled" : ""}>Delete</button>
      </div>
    </div>
  `).join("");
  els.diagramList.querySelectorAll("[data-load-diagram]").forEach(btn => {
    btn.addEventListener("click", () => loadDiagramRecord(btn.dataset.loadDiagram));
  });
  els.diagramList.querySelectorAll("[data-delete-diagram]").forEach(btn => {
    btn.addEventListener("click", () => removeDiagramRecord(btn.dataset.deleteDiagram));
  });
}

function nextUntitledName() {
  const names = new Set(state.library.diagrams.map(d => d.name));
  let index = state.library.diagrams.length + 1;
  let name = "Untitled Diagram " + index;
  while (names.has(name)) {
    index += 1;
    name = "Untitled Diagram " + index;
  }
  return name;
}

function copyName(name) {
  const base = String(name || "Untitled Diagram").trim() || "Untitled Diagram";
  const names = new Set(state.library.diagrams.map(d => d.name));
  if (!names.has(base)) return base;
  let index = 2;
  let candidate = `${base} Copy`;
  while (names.has(candidate)) {
    candidate = `${base} Copy ${index}`;
    index += 1;
  }
  return candidate;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved locally";
  return "Updated " + date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function loadTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (_) {
    // Ignore storage failures and fall back to the user's system setting.
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, state.theme);
  } catch (_) {
    // Theme still applies for the current session if storage is unavailable.
  }
  applyTheme();
}

function applyTheme() {
  els.body.dataset.theme = state.theme;
  const isDark = state.theme === "dark";
  els.themeToggle.textContent = isDark ? "Light" : "Dark";
  els.themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function resetRuntime() {
  state.runtime = createRuntime(state.doc);
  state.running = false;
  state.started = false;
  state.ended = false;
  state.mode = "work";
  state.armed = false;
  state.waitingForFire = false;
  state.lastFrame = null;
  state.stepTarget = null;
  state.checkpoints = [];
  state.maxPausedNodes = new Set();
}

function stopSimulation() {
  if (!state.started) return;
  state.running = false;
  state.started = false;
  state.ended = false;
  state.mode = "work";
  state.armed = false;
  state.waitingForFire = false;
  state.stepTarget = null;
  state.lastFrame = null;
  state.runtime.packages = [];
  state.selected = null;
  state.linkDraft = null;
  setStatus("<strong>Stopped:</strong> simulation ended. Press Start to seed a new run.");
  renderAll();
}

function blockSimulationEdit() {
  if (!state.started) return false;
  showToast("Stop or Reset the simulation before editing the diagram.");
  return true;
}

function addStock() {
  if (blockSimulationEdit()) return;
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
  if (blockSimulationEdit()) return;
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
  if (blockSimulationEdit()) return;
  const doc = baseDoc([
    stock("seed", "Starting Stock", 0, 100, 50, 320, 280, "#bd0129")
  ], []);
  const record = createDiagram(state.library, nextUntitledName(), doc);
  state.doc = record.doc;
  resetRuntime();
  state.selected = { type: "node", id: "seed" };
  setStatus(`<strong>New diagram:</strong> ${escapeHtml(record.name)} is ready.`);
  renderAll();
  renderDiagramLibrary();
}

function importDoc(e) {
  if (state.started) {
    e.target.value = "";
    blockSimulationEdit();
    return;
  }
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const imported = importDiagrams(state.library, payload);
      state.doc = activeDiagram(state.library).doc;
      sanitizeDoc(state.doc);
      state.selected = null;
      resetRuntime();
      setStatus(`<strong>Imported:</strong> ${imported.length} diagram${imported.length === 1 ? "" : "s"} added.`);
      renderAll();
      renderDiagramLibrary();
    } catch (err) {
      showToast("Could not import diagrams: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function renderExamples() {
  els.exampleGrid.innerHTML = "";
  state.examples.forEach(ex => {
    const btn = document.createElement("button");
    btn.className = "example-card";
    btn.type = "button";
    btn.innerHTML = `<h3>${escapeHtml(ex.title)}</h3><p>${escapeHtml(ex.desc)}</p>`;
    btn.addEventListener("click", () => {
      if (blockSimulationEdit()) return;
      state.doc = ex.doc();
      sanitizeDoc(state.doc);
      saveActiveDiagram(state.library, state.doc, ex.title);
      state.selected = null;
      resetRuntime();
      els.examplesModal.classList.remove("open");
      setStatus(`<strong>${escapeHtml(ex.title)}:</strong> loaded as a tunable starting point.`);
      renderAll();
      renderDiagramLibrary();
    });
    els.exampleGrid.append(btn);
  });
}

function openStartDialog() {
  if (state.started) return;
  els.startNodeSelect.innerHTML = state.doc.nodes
    .map(n => `<option value="${n.id}">${escapeHtml(n.label)}</option>`)
    .join("");
  if (state.doc.nodes[0]) els.startNodeSelect.value = state.doc.nodes[0].id;
  els.startAmountInput.value = "20";
  els.startModal.classList.add("open");
  setTimeout(() => els.startAmountInput.focus(), 0);
}

function closeStartDialog() {
  els.startModal.classList.remove("open");
}

function startFromDialog() {
  const nodeId = els.startNodeSelect.value;
  const amount = Number(els.startAmountInput.value);
  if (!nodeById(state.doc, nodeId)) {
    showToast("Choose a node to seed.");
    return;
  }
  if (!Number.isFinite(amount) || amount === 0) {
    showToast("Initial package size must be a non-zero number.");
    return;
  }
  closeStartDialog();
  resetRuntime();
  state.maxPausedNodes = currentMaxNodeIds(state.doc, state.runtime);
  state.started = true;
  state.ended = false;
  state.mode = "simulate";
  state.armed = true;
  state.waitingForFire = false;
  state.selected = null;
  state.linkDraft = null;
  state.runtime.fireNode(nodeId, amount);
  pushCheckpoint();
  if (handleSimulationBoundaries()) {
    renderAll();
    return;
  }
  if (state.stepByStep) {
    setStatus(`<strong>Started:</strong> ${escapeHtml(nodeById(state.doc, nodeId).label)} sent ${amount}. Use Next to step.`);
    startStepForward(false);
  } else {
    state.running = true;
    state.lastFrame = null;
    setStatus(`<strong>Running:</strong> ${escapeHtml(nodeById(state.doc, nodeId).label)} sent ${amount}.`);
    renderAll();
  }
}

function continueRun() {
  if (!state.started || state.ended) return;
  state.runtime.pausedForBreak = false;
  state.armed = true;
  els.continueBtn.style.display = "none";
  if (state.stepByStep) startStepForward();
  else {
    state.running = true;
    state.selected = null;
    state.linkDraft = null;
    state.lastFrame = null;
    renderAll();
  }
}

function togglePause() {
  if (!state.started || state.ended) return;
  if (state.running) {
    state.running = false;
    setStatus(`<strong>Paused:</strong> t = ${state.runtime.simTime.toFixed(1)}. Resume or step/back manually.`);
  } else if (state.stepTarget != null) {
    state.running = true;
    state.selected = null;
    state.linkDraft = null;
    state.lastFrame = null;
    setStatus(`<strong>Resumed:</strong> continuing to t = ${state.stepTarget}.`);
  } else if (state.started && !state.stepByStep) {
    state.running = true;
    state.selected = null;
    state.linkDraft = null;
    state.lastFrame = null;
    setStatus("<strong>Continuing:</strong> simulation is running.");
  } else {
    return;
  }
  renderAll();
}

function handleSimulationShortcut(e) {
  if (!state.started || isTypingTarget(e.target) || els.startModal.classList.contains("open")) return false;
  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
    return true;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    stepBack();
    return true;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    startStepForward();
    return true;
  }
  return false;
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName ? target.tagName.toLowerCase() : "";
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

function startStepForward(captureCurrent = true) {
  if (state.running || !state.started || state.ended) return;
  if (captureCurrent) ensureCheckpoint();
  state.runtime.pausedForBreak = false;
  state.stepTarget = Math.floor(state.runtime.simTime) + 1;
  state.running = true;
  state.armed = true;
  state.waitingForFire = false;
  state.selected = null;
  state.linkDraft = null;
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
    setStatus(`<strong>Step complete:</strong> t = ${Math.floor(state.runtime.simTime)}. Use Next or Prev to inspect the model.`);
  }
}

function stepBack() {
  if (!state.started) return;
  state.running = false;
  state.ended = false;
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
    pausedForBreak: r.pausedForBreak,
    ended: state.ended,
    maxPausedNodes: Array.from(state.maxPausedNodes)
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
  state.ended = Boolean(snapshot.ended);
  state.maxPausedNodes = new Set(snapshot.maxPausedNodes || []);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateRunControls() {
  const pauseBtn = document.getElementById("pauseBtn");
  const startBtn = document.getElementById("startRunBtn");
  const stopBtn = document.getElementById("stopBtn");
  if (!pauseBtn) return;
  els.speedRow.style.display = state.stepByStep ? "none" : "block";
  els.stepRow.style.display = state.stepByStep ? "grid" : "none";
  if (startBtn) startBtn.disabled = state.started;
  if (stopBtn) stopBtn.disabled = !state.started;
  pauseBtn.textContent = state.running ? "Pause" : "Continue";
  pauseBtn.disabled = !state.started || state.ended || (!state.running && state.stepByStep && state.stepTarget == null);
  document.getElementById("prevStepBtn").disabled = !state.started || state.checkpoints.length <= 1;
  document.getElementById("nextStepBtn").disabled = !state.started || state.running || state.ended;
  ["addStockBtn", "addLinkBtn", "diagramsBtn", "examplesBtn", "newBtn", "importBtn"].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = state.started;
  });
  updateRunStateBadge();
}

function syncPanelVisibility() {
  els.editorPanel.classList.toggle("hidden", !state.selected || state.started);
  els.behaviorSection.classList.toggle("hidden", !state.started);
  if (!state.started && els.chartLightbox.classList.contains("open")) toggleChartExpanded(false);
}

function updateRunStateBadge() {
  const stateName = runStateName();
  els.runStateBadge.textContent = stateName.label;
  els.runStateBadge.dataset.state = stateName.key;
  document.getElementById("statusBanner").dataset.state = stateName.key;
}

function runStateName() {
  if (state.running) return { key: "running", label: "Simulation Running" };
  if (state.ended) return { key: "stopped", label: "Simulation Stopped" };
  if (state.started) return { key: "paused", label: "Simulation Paused" };
  if (state.runtime.simTime > 0 || state.runtime.history.length > 1) return { key: "stopped", label: "Simulation Stopped" };
  return { key: "ready", label: "Ready" };
}

function tick(now) {
  if (state.running && !state.runtime.pausedForBreak) {
    if (state.lastFrame == null) state.lastFrame = now;
    const dt = Math.min(.25, (now - state.lastFrame) / 1000) * state.speed;
    state.lastFrame = now;
    if (state.stepTarget != null) {
      state.runtime.advance(Math.min(dt, Math.max(0, state.stepTarget - state.runtime.simTime)));
      if (handleSimulationBoundaries()) {
        renderAll();
        requestAnimationFrame(tick);
        return;
      }
      if (state.runtime.simTime >= state.stepTarget - 0.0001 || state.runtime.pausedForBreak) completeStep();
    } else {
      state.runtime.advance(dt);
      handleSimulationBoundaries();
    }
    renderAll();
  }
  requestAnimationFrame(tick);
}

function handleSimulationBoundaries() {
  if (!state.started || !state.doc.nodes.length) return false;
  const boundary = assessBoundaries(state.doc, state.runtime, state.maxPausedNodes);
  if (boundary.allAtBoundary) {
    state.running = false;
    state.ended = true;
    state.armed = false;
    state.waitingForFire = false;
    state.stepTarget = null;
    state.lastFrame = null;
    setStatus("<strong>Stopped:</strong> every node is at a min or max boundary. Press Stop or Reset to leave simulation.");
    return true;
  }
  const newlyMaxed = boundary.newlyMaxed;
  if (!newlyMaxed.length) return false;
  newlyMaxed.forEach(n => state.maxPausedNodes.add(n.id));
  state.running = false;
  state.lastFrame = null;
  setStatus(`<strong>Warning:</strong> ${escapeHtml(nodeListLabel(newlyMaxed))} reached max. Simulation paused; continue when ready.`);
  return true;
}

function nodeListLabel(nodes) {
  if (nodes.length === 1) return nodes[0].label;
  if (nodes.length === 2) return `${nodes[0].label} and ${nodes[1].label}`;
  return `${nodes.slice(0, -1).map(n => n.label).join(", ")}, and ${nodes[nodes.length - 1].label}`;
}

function onPointerDown(e) {
  const nodeEl = e.target.closest("[data-node]");
  const linkEl = e.target.closest("[data-link]");
  if (state.started) return;
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
  const shouldExpand = typeof force === "boolean" ? force : !els.chartLightbox.classList.contains("open");
  els.chartLightbox.classList.toggle("open", shouldExpand);
  els.body.classList.toggle("chart-expanded", shouldExpand);
  renderBehavior(ctx());
}

window.SystemsExplorer = {
  get state() { return state; },
  get doc() { return cleanDoc(state.doc); },
  fire: (id, dir = 1) => { state.runtime.fireNode(id, dir); renderAll(); },
  step: (dt = 1) => { state.runtime.advance(dt); renderAll(); }
};
