import { MIN_DELAY, MIN_PACKAGE_TRAVEL, PACKAGE_CAP } from "./config.js";
import { enforceNodeBounds, linkById, nodeById } from "./model.js";
import { linkLabel } from "./text.js";

export class Simulation {
  constructor(doc) {
    this.doc = doc;
    this.reset();
  }

  reset() {
    this.values = new Map();
    this.nextFlow = new Map();
    this.packages = [];
    this.simTime = 0;
    this.history = [];
    this.packageEvents = [];
    this.lastEventIndex = 0;
    this.lastSample = -1;
    this.currentOut = new Set();
    this.brokenEver = new Set();
    this.pausedForBreak = false;
    this.doc.nodes.forEach(n => {
      this.values.set(n.id, Number(n.value) || 0);
      this.nextFlow.set(n.id, {
        in: n.flow && n.flow.in ? Math.max(MIN_DELAY, n.flow.in.delay) : Infinity,
        out: n.flow && n.flow.out ? Math.max(MIN_DELAY, n.flow.out.delay) : Infinity
      });
    });
    this.recordHistory();
  }

  getValue(id) {
    return this.values.get(id) ?? 0;
  }

  setValue(id, value) {
    this.values.set(id, value);
  }

  fireNode(id, dir) {
    const source = nodeById(this.doc, id);
    if (!source) return;
    this.spawnOutgoing(id, dir);
  }

  advance(dt) {
    const end = this.simTime + dt;
    const slice = .05;
    while (this.simTime + slice < end) {
      this.step(slice);
      if (this.pausedForBreak) return;
    }
    this.step(Math.max(0, end - this.simTime));
  }

  step(dt) {
    if (dt <= 0) return;
    const oldFloor = Math.floor(this.simTime);
    this.simTime += dt;
    this.applyNaturalFlows();
    this.deliverPackages();
    const newFloor = Math.floor(this.simTime);
    if (newFloor > oldFloor) this.recordHistory();
    this.checkLimits();
    if (this.packages.length > PACKAGE_CAP) this.pausedForBreak = true;
  }

  applyNaturalFlows() {
    this.doc.nodes.forEach(n => {
      if (!n.flow) return;
      const next = this.nextFlow.get(n.id) || { in: Infinity, out: Infinity };
      if (n.flow.in) {
        while (this.simTime >= next.in) {
          this.applyFlow(n, n.flow.in.strength);
          next.in += Math.max(MIN_DELAY, n.flow.in.delay);
        }
      }
      if (n.flow.out) {
        while (this.simTime >= next.out) {
          this.applyFlow(n, -n.flow.out.strength);
          next.out += Math.max(MIN_DELAY, n.flow.out.delay);
        }
      }
      this.nextFlow.set(n.id, next);
    });
  }

  applyFlow(n, delta) {
    const before = this.getValue(n.id);
    const next = Math.min(n.max, Math.max(n.min, before + delta));
    this.setValue(n.id, next);
    return next - before;
  }

  deliverPackages() {
    const arrived = [];
    this.packages.forEach(p => {
      if (!p.delivered && p.arriveTime <= this.simTime) {
        p.delivered = true;
        arrived.push(p);
      }
    });
    this.packages = this.packages.filter(p => (p.visualArriveTime || p.arriveTime) > this.simTime);
    arrived.forEach(p => {
      const target = nodeById(this.doc, p.toId);
      if (!target) return;
      const delta = p.dir * p.amount;
      const actualDelta = this.applyDelta(target, delta);
      this.spawnOutgoing(target.id, actualDelta);
    });
  }

  applyDelta(n, delta) {
    const before = this.getValue(n.id);
    const raw = this.getValue(n.id) + delta;
    const next = enforceNodeBounds(n, raw);
    this.setValue(n.id, next);
    return next - before;
  }

  spawnOutgoing(sourceId, sourceDelta) {
    const source = nodeById(this.doc, sourceId);
    if (!source || Math.abs(sourceDelta) < 0.0001) return;
    this.doc.links.filter(l => l.source === sourceId).forEach(l => {
      const target = nodeById(this.doc, l.target);
      if (!target || !this.linkCanFire(l, sourceDelta)) return;
      const amount = this.linkAmount(l, sourceId, sourceDelta);
      if (amount <= 0) return;
      const logicalDelay = Math.max(MIN_DELAY, l.delay);
      const signedAmount = Math.sign(sourceDelta) * l.polarity * amount;
      const departStep = Math.floor(this.simTime);
      const existing = this.packages.find(p => !p.delivered && p.linkId === l.id && p.departStep === departStep);
      if (existing) {
        this.mergePackage(existing, signedAmount);
        return;
      }
      const pkg = {
        id: "p" + Math.random().toString(36).slice(2),
        linkId: l.id,
        fromId: l.source,
        toId: l.target,
        polarity: l.polarity,
        dir: Math.sign(signedAmount),
        amount,
        departStep,
        departTime: this.simTime,
        arriveTime: this.simTime + logicalDelay,
        visualArriveTime: this.simTime + Math.max(MIN_PACKAGE_TRAVEL, logicalDelay),
        delivered: false
      };
      this.packages.push(pkg);
      this.packageEvents.push({
        packageId: pkg.id,
        t: this.simTime,
        linkId: l.id,
        from: source.label,
        to: target.label,
        dir: pkg.dir,
        amount,
        delay: l.delay,
        label: linkLabel(l)
      });
    });
  }

  mergePackage(pkg, signedAmount) {
    const total = pkg.dir * pkg.amount + signedAmount;
    const event = this.packageEvents.find(e => e.packageId === pkg.id);
    if (Math.abs(total) < 0.0001) {
      this.packages = this.packages.filter(p => p.id !== pkg.id);
      this.packageEvents = this.packageEvents.filter(e => e.packageId !== pkg.id);
      return;
    }
    pkg.dir = Math.sign(total);
    pkg.amount = Math.abs(total);
    if (event) {
      event.dir = pkg.dir;
      event.amount = pkg.amount;
    }
  }

  linkCanFire(l, sourceDelta) {
    if (l.trigger === "increase" && sourceDelta <= 0) return false;
    if (l.trigger === "decrease" && sourceDelta >= 0) return false;
    const sourceValue = this.getValue(l.source);
    if (l.gate === "above") return sourceValue > Number(l.gateValue || 0);
    if (l.gate === "below") return sourceValue < Number(l.gateValue || 0);
    return true;
  }

  linkAmount(l, sourceId, sourceDelta) {
    const amount = Number(l.amount ?? l.strength ?? 0) || 0;
    if (l.mode === "prop") return Math.abs(this.getValue(sourceId)) * amount / 100;
    if (l.mode === "delta") return Math.abs(sourceDelta) * amount / 100;
    return amount;
  }

  checkLimits() {
    this.doc.nodes.forEach(n => {
      const out = this.outOfRange(n, this.getValue(n.id));
      if (out) {
        this.currentOut.add(n.id);
        this.brokenEver.add(n.id);
      } else {
        this.currentOut.delete(n.id);
      }
    });
  }

  outOfRange(n, value) {
    return value > n.max || value < n.min;
  }

  recordHistory() {
    const whole = Math.floor(this.simTime);
    if (whole === this.lastSample) return;
    this.lastSample = whole;
    const values = {};
    this.doc.nodes.forEach(n => values[n.id] = this.getValue(n.id));
    const events = this.packageEvents.slice(this.lastEventIndex);
    this.lastEventIndex = this.packageEvents.length;
    const linkEvents = {};
    this.doc.links.forEach(l => { linkEvents[l.id] = events.filter(e => e.linkId === l.id); });
    this.history.push({ t: this.simTime, values, events, linkEvents, activePackages: this.packages.length });
    if (this.history.length > 220) this.history.shift();
  }
}

export function createRuntime(doc) {
  return new Simulation(doc);
}

export function packageLink(doc, p) {
  return linkById(doc, p.linkId);
}
