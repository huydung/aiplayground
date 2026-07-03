import { baseDoc, cleanDoc, sanitizeDoc, stock } from "./model.js";

export const fallbackExample = {
  key: "starter",
  title: "Starter Diagram",
  desc: "A blank starting point for a local systems model.",
  doc: () => baseDoc([
    stock("seed", "Starting Node", 0, 100, 50, 320, 280, "#bd0129")
  ], [])
};

export async function loadExamples() {
  try {
    const manifest = await fetchJson("./examples/manifest.json");
    const examples = await Promise.all(manifest.map(file => fetchJson("./examples/" + file)));
    const loaded = examples.map(exampleFromJson).filter(Boolean);
    return loaded.length ? loaded : [fallbackExample];
  } catch (err) {
    console.warn("Could not load example diagrams", err);
    return [fallbackExample];
  }
}

function exampleFromJson(raw) {
  if (!raw || !raw.doc || !raw.doc.nodes || !raw.doc.links) return null;
  return {
    key: String(raw.key || raw.title || "example"),
    title: String(raw.title || "Untitled Example"),
    desc: String(raw.desc || ""),
    doc: () => {
      const doc = cleanDoc(raw.doc);
      sanitizeDoc(doc);
      return doc;
    }
  };
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}
