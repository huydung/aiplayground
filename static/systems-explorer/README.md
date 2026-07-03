# HDI Systems Explorer

HDI Systems Explorer is a client-side systems-thinking tool served at `/systems-explorer/`. It lets a facilitator build casual feedback diagrams, run animated package-based simulations, compare multiple tabs of the same diagram, and annotate loops with movable `R` and `B` labels.

The legacy `/systems-explorer.html` path redirects here, so Fly serves the app at both:

- `https://hdi.fly.dev/systems-explorer/`
- `https://hdi.fly.dev/systems-explorer.html`

## Current Design

- Pure static ES modules; no server API or database is used by the tool.
- One shared SVG coordinate system renders nodes, links, loop labels, packages, and controls.
- Diagram state is local-only and saved in `localStorage`.
- Export/import uses JSON for the full local diagram library.
- A saved diagram can contain multiple tabs. Each tab is a complete editable view of the system, useful for variants, tweaks, and workshop scenarios.
- Loop labels are manual teaching annotations: `R` for reinforcing and `B` for balancing. Their SVG tooltip is the label title.
- The visual system is a single fixed HDI light brand theme with no alternate color theme.

## File Map

- `index.html`
  App shell for the header, tab bar, SVG canvas, simulator panel, editor panel, chart lightbox, and modals.

- `styles.css`
  Fixed light-mode HDI visual system, layout, diagram styling, tabs, loop labels, charts, tables, and modals.

- `src/config.js`
  Simulation constants, SVG namespace, HDI palette, and link rule option metadata.

- `src/model.js`
  Data constructors and sanitizers for documents, nodes, links, natural flows, and loop labels.

- `src/storage.js`
  Local diagram library, diagram tabs, import/export, and JSON download.

- `src/simulation.js`
  Package simulation engine. It owns values, package delivery, natural flow timing, history samples, and safety caps.

- `src/diagram.js`
  SVG rendering for links, nodes, packages, loop labels, route de-overlap, pan/zoom alignment, and hit targets.

- `src/panels.js`
  Property editor, behavior-over-time chart, and step table.

- `src/app.js`
  App orchestration: UI binding, diagram tabs, selection, dragging, pan/zoom, simulation controls, examples, diagrams, and import/export.

- `examples/`
  Editable system archetype examples. `manifest.json` controls which JSON files appear in the Examples modal.

## Simulation Semantics

The simulator is illustrative, not predictive. It is built for workshop explanation:

- Pressing Start opens a seed dialog. The seed sends packages from the chosen node but does not change that source node's value.
- A package travels along a link for the link's delay, then changes the target value.
- The target's actual value change can fire outgoing links.
- Link polarity controls direction: same `(s)` preserves direction; opposite `(o)` reverses it.
- Trigger and gate settings decide whether a changed source can fire a link.
- Payload mode and amount decide how much value a package carries.
- Natural flow changes only its own node, clamps to the node bounds, and never fires outgoing links.
- If package volume exceeds the configured safety cap, the simulation pauses.

## Editing Model

- Nodes have a label, min, max, start value, color, strict-bound toggles, and optional natural flow in/out.
- Links connect source to target nodes and support polarity, trigger, gate, payload, amount, and delay.
- Loop labels are movable canvas objects with type `R` or `B` and an editable title.
- Tabs duplicate the active tab by default so a facilitator can branch the model quickly.

## Saved Library

The app stores the diagram library in `localStorage` under `hdi-systems-explorer-library-v1`. A library contains diagrams; each diagram contains tabs; each tab contains a complete document.

Export downloads the full library as `systems-explorer-diagrams.json`. Import accepts a full library or a single document and adds it to the local library.

See [FORMAT.md](./FORMAT.md) for the exact JSON shape.
