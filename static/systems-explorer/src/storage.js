import { cleanDoc } from "./model.js";

const LIBRARY_KEY = "hdi-systems-explorer-library-v1";
const LIBRARY_TYPE = "hdi-systems-explorer-library";

export function loadDiagramLibrary(fallbackDoc, fallbackName = "Untitled Diagram") {
  const stored = readJson(LIBRARY_KEY);
  const library = normalizeLibrary(stored);
  if (library.diagrams.length) return library;

  const created = createLibrary([createDiagramRecord(fallbackName, fallbackDoc)]);
  saveDiagramLibrary(created);
  return created;
}

export function saveDiagramLibrary(library) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(normalizeLibrary(library)));
}

export function activeDiagram(library) {
  return library.diagrams.find(d => d.id === library.activeId) || library.diagrams[0] || null;
}

export function activeTab(recordOrLibrary) {
  const record = recordOrLibrary && Array.isArray(recordOrLibrary.diagrams)
    ? activeDiagram(recordOrLibrary)
    : recordOrLibrary;
  if (!record) return null;
  return record.tabs.find(t => t.id === record.activeTabId) || record.tabs[0] || null;
}

export function activeDoc(library) {
  return activeTab(library)?.doc || null;
}

export function saveActiveDiagram(library, doc, name = null) {
  const active = activeDiagram(library);
  if (!active) return library;
  const tab = activeTab(active);
  if (tab) {
    tab.doc = cleanDoc(doc);
    tab.updatedAt = new Date().toISOString();
  }
  if (name !== null) active.name = cleanName(name);
  active.updatedAt = new Date().toISOString();
  saveDiagramLibrary(library);
  return library;
}

export function createDiagram(library, name, doc) {
  const record = createDiagramRecord(name, doc);
  library.diagrams.unshift(record);
  library.activeId = record.id;
  saveDiagramLibrary(library);
  return record;
}

export function activateDiagram(library, id) {
  if (library.diagrams.some(d => d.id === id)) {
    library.activeId = id;
    saveDiagramLibrary(library);
  }
  return activeDiagram(library);
}

export function createTab(library, name, doc) {
  const active = activeDiagram(library);
  if (!active) return null;
  const tab = createTabRecord(name, doc);
  active.tabs.push(tab);
  active.activeTabId = tab.id;
  active.updatedAt = new Date().toISOString();
  saveDiagramLibrary(library);
  return tab;
}

export function activateTab(library, id) {
  const active = activeDiagram(library);
  if (!active || !active.tabs.some(t => t.id === id)) return activeTab(active);
  active.activeTabId = id;
  active.updatedAt = new Date().toISOString();
  saveDiagramLibrary(library);
  return activeTab(active);
}

export function renameActiveTab(library, name) {
  const tab = activeTab(library);
  if (!tab) return null;
  tab.name = cleanName(name, "View");
  tab.updatedAt = new Date().toISOString();
  const active = activeDiagram(library);
  if (active) active.updatedAt = tab.updatedAt;
  saveDiagramLibrary(library);
  return tab;
}

export function deleteActiveTab(library, fallbackDoc) {
  const active = activeDiagram(library);
  if (!active) return null;
  if (active.tabs.length <= 1) return activeTab(active);
  active.tabs = active.tabs.filter(t => t.id !== active.activeTabId);
  if (!active.tabs.length) active.tabs.push(createTabRecord("Base", fallbackDoc));
  active.activeTabId = active.tabs[0].id;
  active.updatedAt = new Date().toISOString();
  saveDiagramLibrary(library);
  return activeTab(active);
}

export function deleteDiagram(library, id, fallbackDoc) {
  library.diagrams = library.diagrams.filter(d => d.id !== id);
  if (!library.diagrams.length) library.diagrams.push(createDiagramRecord("Untitled Diagram", fallbackDoc));
  if (!library.diagrams.some(d => d.id === library.activeId)) library.activeId = library.diagrams[0].id;
  saveDiagramLibrary(library);
  return activeDiagram(library);
}

export function importDiagrams(library, payload) {
  const incoming = diagramsFromPayload(payload);
  const existingIds = new Set(library.diagrams.map(d => d.id));
  const now = new Date().toISOString();
  const records = incoming.map((d, index) => {
    const record = normalizeDiagramRecord({ ...d, name: d.name || `Imported Diagram ${index + 1}` });
    while (existingIds.has(record.id)) record.id = generateId();
    existingIds.add(record.id);
    record.createdAt = d.createdAt || now;
    record.updatedAt = d.updatedAt || now;
    return record;
  });
  library.diagrams = records.concat(library.diagrams);
  if (records[0]) library.activeId = records[0].id;
  saveDiagramLibrary(library);
  return records;
}

export function exportDiagramLibrary(library) {
  const exportable = {
    type: LIBRARY_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    activeId: library.activeId,
    diagrams: normalizeLibrary(library).diagrams
  };
  downloadJson(exportable, "systems-explorer-diagrams.json");
}

export function diagramName(library) {
  return activeDiagram(library)?.name || "Untitled Diagram";
}

export function tabName(library) {
  return activeTab(library)?.name || "Base";
}

function createLibrary(diagrams) {
  return {
    version: 1,
    activeId: diagrams[0]?.id || null,
    diagrams
  };
}

function createDiagramRecord(name, doc) {
  const now = new Date().toISOString();
  const tab = createTabRecord("Base", doc, now);
  return {
    id: generateId(),
    name: cleanName(name),
    activeTabId: tab.id,
    tabs: [tab],
    createdAt: now,
    updatedAt: now
  };
}

function normalizeLibrary(value) {
  const rawDiagrams = value && Array.isArray(value.diagrams) ? value.diagrams : [];
  const diagrams = rawDiagrams
    .filter(d => d && (Array.isArray(d.tabs) || (d.doc && d.doc.nodes && d.doc.links)))
    .map(normalizeDiagramRecord);
  return {
    version: 1,
    activeId: diagrams.some(d => d.id === value?.activeId) ? value.activeId : diagrams[0]?.id || null,
    diagrams
  };
}

function normalizeDiagramRecord(d) {
  const now = new Date().toISOString();
  const rawTabs = Array.isArray(d.tabs) && d.tabs.length
    ? d.tabs
    : [{ id: d.activeTabId || generateId(), name: "Base", doc: d.doc, createdAt: d.createdAt, updatedAt: d.updatedAt }];
  const tabs = rawTabs
    .filter(t => t && t.doc && t.doc.nodes && t.doc.links)
    .map((t, index) => normalizeTabRecord(t, index));
  if (!tabs.length && d.doc) tabs.push(createTabRecord("Base", d.doc));
  return {
    id: String(d.id || generateId()),
    name: cleanName(d.name),
    activeTabId: tabs.some(t => t.id === d.activeTabId) ? d.activeTabId : tabs[0]?.id || null,
    tabs,
    createdAt: d.createdAt || now,
    updatedAt: d.updatedAt || d.createdAt || now
  };
}

function createTabRecord(name, doc, timestamp = new Date().toISOString()) {
  return {
    id: generateId(),
    name: cleanName(name, "View"),
    doc: cleanDoc(doc),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function normalizeTabRecord(tab, index) {
  const now = new Date().toISOString();
  return {
    id: String(tab.id || generateId()),
    name: cleanName(tab.name || `View ${index + 1}`, "View"),
    doc: cleanDoc(tab.doc),
    createdAt: tab.createdAt || now,
    updatedAt: tab.updatedAt || tab.createdAt || now
  };
}

function diagramsFromPayload(payload) {
  if (payload && Array.isArray(payload.diagrams)) {
    return payload.diagrams
      .filter(d => d && (Array.isArray(d.tabs) || (d.doc && d.doc.nodes && d.doc.links)))
      .map(d => normalizeDiagramRecord(d));
  }
  if (payload && payload.nodes && payload.links) return [{ name: "Imported Diagram", doc: payload }];
  throw new Error("JSON must contain a diagram or a Systems Explorer diagram library.");
}

function cleanName(name, fallback = "Untitled Diagram") {
  const text = String(name || "").trim();
  return text || fallback;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return "d" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
