import { STORE_KEY } from "./config.js";
import { cleanDoc } from "./model.js";

export function loadStoredDoc() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveDoc(doc) {
  localStorage.setItem(STORE_KEY, JSON.stringify(cleanDoc(doc)));
}

export function exportDoc(doc) {
  const blob = new Blob([JSON.stringify(cleanDoc(doc), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "systems-explorer.json";
  a.click();
  URL.revokeObjectURL(url);
}
