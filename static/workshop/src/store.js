// Vanilla port of the poker DataProvider (static/hdpg-poker.html ~lines 3186–3330).
// Server keeps a monotonic _rev; every write echoes the rev it was based on, and the server
// rejects (409) writes based on an older rev — this is what stops a stale/backgrounded tab from
// clobbering newer data. Cache-in-localStorage seeds the UI instantly; server is source of truth.
import { getToken, clearAuth, userId } from './api.js';
import { mergeSeeds } from './seeds.js';

let data = null;        // current blob (no _rev)
let rev = null;         // server rev this client is based on (null = not loaded)
let loaded = false;     // initial server fetch resolved
let dirty = false;      // unsaved local edits
let offline = false;
let syncTimer = null;

const subs = new Set();
const lsKey = () => `workshop_data_${userId()}`;

function emit() { for (const fn of subs) fn(); }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function getData() { return data ?? {}; }
export function isOffline() { return offline; }
export function isLoaded() { return loaded; }

function writeCache(d) { try { localStorage.setItem(lsKey(), JSON.stringify(d)); } catch {} }
function readCache() { try { const c = localStorage.getItem(lsKey()); return c ? JSON.parse(c) : null; } catch { return null; } }

function adoptServer(server) {
  const { _rev, ...clean } = server || {};
  rev = typeof _rev === 'number' ? _rev : 0;
  const { data: merged, changed } = mergeSeeds(clean);
  data = merged;
  dirty = false;
  writeCache(data);
  // First login (or a new seed version) fills empty collections — persist so they're editable.
  if (changed) { dirty = true; scheduleSync(); }
}

// Low-level PUT with optimistic concurrency; keepalive so it survives page close.
async function putData(opts = {}) {
  if (!loaded || rev === null || data == null) return;
  const body = { ...data, _rev: rev };
  if (opts.snapshot) body._snapshot = opts.snapshot;
  try {
    const res = await fetch('/api/workshop/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (res.status === 409) {
      const server = await res.json().catch(() => ({}));
      adoptServer(server);           // server has newer data — adopt, drop our write
      offline = false; emit();
      return;
    }
    if (res.status === 401) { doLogout(); return; }
    if (!res.ok) throw new Error(res.status);
    const b = await res.json().catch(() => ({}));
    if (typeof b._rev === 'number') rev = b._rev;
    dirty = false; offline = false; emit();
  } catch {
    offline = true; emit();          // keep dirty; retry on next flush/edit
  }
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; putData(); }, 800);
}

export function flush(opts) {
  clearTimeout(syncTimer);
  syncTimer = null;
  putData(opts);
}

// Mutate the blob. `mutator(draft)` edits in place (return value ignored).
export function update(mutator) {
  if (data == null) data = {};
  mutator(data);
  dirty = true;
  writeCache(data);
  scheduleSync();
  emit();
}

let onLogoutCb = null;
export function onLogout(fn) { onLogoutCb = fn; }
function doLogout() { clearAuth(); if (onLogoutCb) onLogoutCb(); }

export async function load() {
  const cached = readCache();
  if (cached) { data = cached; emit(); }        // instant paint while server wakes
  offline = false;
  try {
    const res = await fetch('/api/workshop/data', { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error(res.status);
    const server = await res.json();
    adoptServer(server);                         // always adopt server on load
    loaded = true;
    emit();
  } catch (e) {
    if (String(e.message) === '401') { doLogout(); return; }
    offline = true; emit();                      // cached data (if any) shown; writes gated
  }
}

export function retry() { return load(); }

// Save on hide/close; refresh on foreground/bfcache restore (only when no unsaved edits).
window.addEventListener('pagehide', () => { if (syncTimer) flush(); });
window.addEventListener('pageshow', (e) => { if (e.persisted && !dirty) load(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { if (syncTimer) flush(); }
  else if (!dirty) load();
});
