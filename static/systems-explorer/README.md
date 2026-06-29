# HDI Systems Explorer

Static ES-module app served at `/systems-explorer/`.

## File Map

- `index.html`  
  App shell only. Keep markup for panels, modal, canvas, and readouts here.

- `styles.css`  
  Visual system and layout. Tweak panel sizing, colors, typography, diagram styling, and table density here.

- `src/config.js`  
  Global constants: localStorage key, package timing, color palette, trigger options, and gate options.

- `src/model.js`  
  Data shape, stock/link constructors, archetype examples, import cleanup, and validation.  
  Add or tune example systems here.

- `src/simulation.js`  
  The simulation engine. This is where rule-link semantics live:
  - `trigger`: which source change can fire the link (`any`, `increase`, `decrease`)
  - `gate`: which source value situation allows firing (`always`, `above`, `below`) using `gateValue` as the threshold
  - `mode` + `amount`: fixed payload, percent of source value, or percent of source delta
  - logical delivery and visual package travel are separated so packages remain visible.

- `src/diagram.js`  
  SVG rendering: stocks, curved links, labels, package triangles, fire buttons, and route de-overlap.

- `src/panels.js`  
  Editor and Behavior over time. The step table intentionally creates one column per rule link, so each step shows which links sent packages.

- `src/storage.js`  
  LocalStorage, JSON import/export cleanup.

- `src/app.js`  
  App orchestration: DOM binding, selection, dragging, pan/zoom, mode switching, examples modal, and ticking the simulation.

## Link Rule Semantics

A connection is no longer just a strength. It is:

`WHEN source change matches trigger AND source value passes gate -> send package`

Example:

`Gap to Milestone -> Overtime`

- Trigger: `increase`
- Gate: `above`, threshold `0`
- Meaning: when the gap increases and the gap is above 0, send a package to Overtime.
- If the gap is below 0, this link does not fire.

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
