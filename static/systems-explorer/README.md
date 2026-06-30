# HDI Systems Explorer

Static ES-module app served at `/systems-explorer/`.

## File Map

- `index.html`  
  App shell only. Keep markup for panels, modal, canvas, and readouts here.

- `styles.css`  
  Visual system and layout. Tweak panel sizing, colors, typography, diagram styling, and table density here.

- `src/config.js`  
  Global constants: localStorage key, package timing, color palette, and label metadata used by chart/table text.

- `src/model.js`  
  Data shape, stock/link constructors, import cleanup, and validation.

- `examples/`  
  Editable example models. `manifest.json` lists the JSON files loaded into the Examples modal.

- `src/simulation.js`  
  The simulation engine. New links default to always-on 100% source-delta propagation, but rule settings remain editable:
  - trigger and gate decide whether a source change can fire the link
  - payload mode and amount decide how much value the package carries
  - polarity decides whether the target changes in the same or opposite direction
  - delay controls logical delivery timing
  - each link emits at most one net package per integer step
  - logical delivery and visual package travel are separated so packages remain visible.

- `src/diagram.js`  
  SVG rendering: stocks, curved links, labels, package triangles, and route de-overlap.

- `src/panels.js`  
  Property editor and Behavior over time. The step table intentionally creates one column per rule link, so each step shows which links sent packages.

- `src/storage.js`  
  LocalStorage diagram library, migration from the old single-diagram save slot, and JSON import/export.

- `src/app.js`  
  App orchestration: DOM binding, selection, dragging, pan/zoom, Simulator controls, Start dialog, examples modal, and ticking the simulation.

## Link Rule Semantics

A connection defaults to a simple rule:

`source delta -> 100% package -> target delta`

Example:

`Gap to Milestone -> Overtime`

- If polarity is `same (s)`, a +20 source delta sends a +20 package.
- If polarity is `opposite (o)`, a +20 source delta sends a -20 package.
- Trigger, gate, payload mode, amount, and delay remain editable.
- If one link receives multiple sends in the same step, they merge into a single net package icon/event.

## Data Shape

```js
{
  nodes: [
    { id, label, kind: "stock", min, max, value, x, y, color, minStrict, maxStrict, flow }
  ],
  links: [
    { id, source, target, polarity, mode, amount, delay, trigger, gate, gateValue }
  ]
}
```

Bounds are strict per side: `minStrict` clamps values below `min`, and `maxStrict` clamps values above `max`. If a side is unchecked, flows and received packages may push the value beyond that boundary and the node pulses.

Variables are intentionally removed. Model semantics now belong on links.

## Saved Diagrams

The app stores a local diagram library in `localStorage` under `hdi-systems-explorer-library-v1`. Export creates a portable JSON file containing all saved diagrams, their names, timestamps, and docs.

See [FORMAT.md](./FORMAT.md) for the exact single-diagram, example, and exported-library JSON formats.
