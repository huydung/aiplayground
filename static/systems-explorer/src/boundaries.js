const EPSILON = 0.0001;

export function assessBoundaries(doc, runtime, pausedMaxIds = new Set()) {
  const nodes = doc.nodes || [];
  return {
    allAtBoundary: nodes.length > 0 && nodes.every(n => isAtBoundary(n, runtime.getValue(n.id))),
    newlyMaxed: nodes.filter(n => isAtMaxValue(n, runtime.getValue(n.id)) && !pausedMaxIds.has(n.id))
  };
}

export function currentMaxNodeIds(doc, runtime) {
  return new Set((doc.nodes || []).filter(n => isAtMaxValue(n, runtime.getValue(n.id))).map(n => n.id));
}

function isAtBoundary(n, value) {
  return value <= Number(n.min) + EPSILON || value >= Number(n.max) - EPSILON;
}

function isAtMaxValue(n, value) {
  return value >= Number(n.max) - EPSILON;
}
