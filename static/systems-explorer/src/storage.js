import { STORE_KEY } from "./config.js";
import { cleanDoc } from "./model.js";

const LIBRARY_KEY = "hdi-systems-explorer-library-v1";
const LIBRARY_TYPE = "hdi-systems-explorer-library";

export function loadDiagramLibrary(fallbackDoc, fallbackName = "Untitled Diagram") {
  const stored = readJson(LIBRARY_KEY);
  const library = normalizeLibrary(stored);
  if (library.diagrams.length) return library;

  const legacyDoc = readJson(STORE_KEY);
  const doc = legacyDoc && legacyDoc.nodes && legacyDoc.links ? legacyDoc : fallbackDoc;
  const name = legacyDoc ? "Saved Diagram" : fallbackName;
  const migrated = createLibrary([createDiagramRecord(name, doc)]);
  saveDiagramLibrary(migrated);
  return migrated;
}

export function saveDiagramLibrary(library) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(normalizeLibrary(library)));
}

export function activeDiagram(library) {
  return library.diagrams.find(d => d.id === library.activeId) || library.diagrams[0] || null;
}

export function saveActiveDiagram(library, doc, name = null) {
  const active = activeDiagram(library);
  if (!active) return library;
  active.doc = cleanDoc(doc);
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
    const record = createDiagramRecord(d.name || `Imported Diagram ${index + 1}`, d.doc);
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

function createLibrary(diagrams) {
  return {
    version: 1,
    activeId: diagrams[0]?.id || null,
    diagrams
  };
}

function createDiagramRecord(name, doc) {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: cleanName(name),
    doc: cleanDoc(doc),
    createdAt: now,
    updatedAt: now
  };
}

function normalizeLibrary(value) {
  const rawDiagrams = value && Array.isArray(value.diagrams) ? value.diagrams : [];
  const diagrams = rawDiagrams
    .filter(d => d && d.doc && d.doc.nodes && d.doc.links)
    .map(d => ({
      id: String(d.id || generateId()),
      name: cleanName(d.name),
      doc: cleanDoc(d.doc),
      createdAt: d.createdAt || new Date().toISOString(),
      updatedAt: d.updatedAt || d.createdAt || new Date().toISOString()
    }));
  return {
    version: 1,
    activeId: diagrams.some(d => d.id === value?.activeId) ? value.activeId : diagrams[0]?.id || null,
    diagrams
  };
}

function diagramsFromPayload(payload) {
  if (payload && Array.isArray(payload.diagrams)) {
    return payload.diagrams
      .filter(d => d && d.doc && d.doc.nodes && d.doc.links)
      .map(d => ({ name: d.name, doc: d.doc, createdAt: d.createdAt, updatedAt: d.updatedAt }));
  }
  if (payload && payload.nodes && payload.links) return [{ name: "Imported Diagram", doc: payload }];
  throw new Error("JSON must contain a diagram or a Systems Explorer diagram library.");
}

function cleanName(name) {
  const text = String(name || "").trim();
  return text || "Untitled Diagram";
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
