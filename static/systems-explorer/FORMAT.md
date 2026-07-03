# Systems Explorer JSON Format

Systems Explorer stores and exchanges JSON for:

1. Complete local libraries
2. Diagram records inside a library
3. Tabs inside a diagram
4. Single tab documents
5. Example files

All formats are local-only and static-app friendly. No server database is involved.

## Library Export

The exported file contains every saved local diagram and every tab in each diagram.

```json
{
  "type": "hdi-systems-explorer-library",
  "version": 1,
  "exportedAt": "2026-07-03T00:00:00.000Z",
  "activeId": "diagram-1",
  "diagrams": [
    {
      "id": "diagram-1",
      "name": "Fixes That Fail",
      "activeTabId": "tab-base",
      "createdAt": "2026-07-03T00:00:00.000Z",
      "updatedAt": "2026-07-03T00:00:00.000Z",
      "tabs": [
        {
          "id": "tab-base",
          "name": "Base",
          "createdAt": "2026-07-03T00:00:00.000Z",
          "updatedAt": "2026-07-03T00:00:00.000Z",
          "doc": {
            "version": 5,
            "nextId": 20,
            "nodes": [],
            "links": [],
            "loops": []
          }
        }
      ]
    }
  ]
}
```

## Document

A document is the editable content of one tab.

```json
{
  "version": 5,
  "nextId": 20,
  "nodes": [
    {
      "id": "gap",
      "label": "Gap to Milestone",
      "kind": "stock",
      "min": -20,
      "max": 100,
      "value": 0,
      "x": 210,
      "y": 250,
      "color": "#BD0129",
      "minStrict": true,
      "maxStrict": true,
      "flow": {
        "in": null,
        "out": { "strength": 5, "delay": 2 }
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
  ],
  "loops": [
    {
      "id": "loop1",
      "type": "B",
      "title": "Quick fix closes the gap",
      "x": 350,
      "y": 180
    }
  ]
}
```

## Node Fields

- `id`: Stable unique string. Links refer to this.
- `label`: Visible node name.
- `kind`: Always `"stock"` in the current data model.
- `min`, `max`: Boundary values.
- `value`: Starting value for reset and simulation start.
- `x`, `y`: Canvas position.
- `color`: Hex color used for the node, chart line, and fill.
- `minStrict`, `maxStrict`: When true, link effects clamp at that side. When false, values may pass the side and the node pulses.
- `flow.in`, `flow.out`: Optional natural flow. Natural flow changes only this node, clamps within `[min, max]`, and does not fire links.

## Link Fields

- `id`: Stable unique string.
- `source`, `target`: Node IDs.
- `polarity`: `1` for same `(s)`, `-1` for opposite `(o)`.
- `mode`: `"fixed"`, `"prop"`, or `"delta"`.
- `amount`: Numeric payload amount. For `"delta"`, this is percent of source delta. For `"prop"`, this is percent of source value.
- `strength`, `frac`: Derived compatibility fields used by cleanup/import.
- `delay`: Delivery delay in simulation time.
- `trigger`: `"any"`, `"increase"`, or `"decrease"`.
- `gate`: `"always"`, `"above"`, or `"below"`.
- `gateValue`: Threshold used by `above`/`below`.

## Loop Label Fields

- `id`: Stable unique string.
- `type`: `"R"` for reinforcing or `"B"` for balancing.
- `title`: Tooltip and editor title for the loop.
- `x`, `y`: Canvas position.

## Example File

Each file in `examples/` wraps one document with metadata:

```json
{
  "key": "fixes",
  "title": "Fixes That Fail",
  "desc": "Overtime closes the gap fast, then delayed burnout reopens the same problem.",
  "doc": {
    "version": 5,
    "nextId": 20,
    "nodes": [],
    "links": [],
    "loops": []
  }
}
```

Add the filename to `examples/manifest.json` for it to appear in the Examples modal.
