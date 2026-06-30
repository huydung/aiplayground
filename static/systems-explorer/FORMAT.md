# Systems Explorer JSON Format

Systems Explorer uses JSON for three related things:

1. Single diagram documents
2. Editable example files in `examples/`
3. Exported multi-diagram libraries

All formats are local-only and static-app friendly. No server database is involved.

## Single Diagram

A diagram document is the core model shape. It can be imported directly, and it is also nested inside examples and library exports.

```json
{
  "version": 5,
  "nextId": 20,
  "nodes": [
    {
      "id": "gap",
      "label": "Gap to Milestone",
      "kind": "stock",
      "min": -50,
      "max": 100,
      "value": 80,
      "x": 210,
      "y": 250,
      "color": "#bd0129",
      "minStrict": true,
      "maxStrict": true,
      "flow": {
        "in": null,
        "out": { "strength": 2, "delay": 2 }
      }
    }
  ],
  "links": [
    {
      "id": "l1",
      "source": "gap",
      "target": "ot",
      "polarity": 1,
      "mode": "delta",
      "amount": 100,
      "strength": 100,
      "frac": 1,
      "delay": 1,
      "trigger": "any",
      "gate": "always",
      "gateValue": 0
    }
  ]
}
```

## Node Fields

- `id`: Stable unique string. Links refer to this.
- `label`: Visible node name.
- `kind`: Always `"stock"` in the current app.
- `min`, `max`: Boundary values.
- `value`: Starting value.
- `x`, `y`: Canvas position.
- `color`: Hex color used for node border, title, chart line, and fill.
- `minStrict`, `maxStrict`: When true, values clamp at that side.
- `flow.in`, `flow.out`: Optional natural flow. Use `null` when absent.

## Link Fields

- `id`: Stable unique string.
- `source`, `target`: Node IDs.
- `polarity`: `1` for same `(s)`, `-1` for opposite `(o)`.
- `mode`: `"fixed"`, `"prop"`, or `"delta"`.
- `amount`: Numeric amount. For `"delta"`, this is percent of source delta.
- `strength`, `frac`: Compatibility fields retained by cleanup/import.
- `delay`: Delivery delay in simulation time.
- `trigger`: `"any"`, `"increase"`, or `"decrease"`.
- `gate`: `"always"`, `"above"`, or `"below"`.
- `gateValue`: Threshold used by `above`/`below`.

## Example File

Each file in `examples/` wraps a single diagram with metadata:

```json
{
  "key": "fixes",
  "title": "Fixes That Fail",
  "desc": "Overtime closes a milestone gap only while the gap is positive.",
  "doc": { "version": 5, "nextId": 20, "nodes": [], "links": [] }
}
```

Add the filename to `examples/manifest.json` for it to appear in the Examples modal.

## Exported Library

The Diagrams modal exports every saved local diagram as:

```json
{
  "type": "hdi-systems-explorer-library",
  "version": 1,
  "exportedAt": "2026-06-30T00:00:00.000Z",
  "activeId": "diagram-id",
  "diagrams": [
    {
      "id": "diagram-id",
      "name": "My Diagram",
      "doc": { "version": 5, "nextId": 20, "nodes": [], "links": [] },
      "createdAt": "2026-06-30T00:00:00.000Z",
      "updatedAt": "2026-06-30T00:00:00.000Z"
    }
  ]
}
```

The app can import either this library format or a single diagram document.
