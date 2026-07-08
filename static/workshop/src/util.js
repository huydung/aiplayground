// Small DOM + formatting helpers shared across views. No framework.

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// el('div.klass#id', { attrs }, [children | string]) — terse element builder.
export function el(spec, attrs = {}, children = []) {
  const m = spec.match(/^([a-z0-9]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i) || [];
  const tag = m[1] || 'div';
  const node = document.createElement(tag);
  if (m[2]) node.id = m[2].slice(1);
  if (m[3]) node.className = m[3].slice(1).replace(/\./g, ' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = (node.className + ' ' + v).trim();
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// minutes → "1h 58m" / "58m"
export function fmtDuration(min) {
  const m = Math.max(0, Math.round(min || 0));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// "HH:MM" + offset minutes → "HH:MM" (24h; wraps past midnight harmlessly)
export function addClock(startHHMM, offsetMin) {
  const [h, m] = String(startHHMM || '00:00').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  let total = (h * 60 + m + Math.round(offsetMin || 0)) % (24 * 60);
  if (total < 0) total += 24 * 60;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function todayISO() { return new Date().toISOString().slice(0, 10); }
