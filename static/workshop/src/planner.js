// Dashboard, run-sheet planner, idea bank, and item-type manager (Phase 1).
import * as store from './store.js';
import { el, clear, esc, uid, fmtDuration, addClock, todayISO } from './util.js';

// --- store accessors ---
const data = () => store.getData();
const workshops = () => data().workshops || [];
const types = () => data().planItemTypes || [];
const bank = () => data().ideaBank || [];
const findWorkshop = (id) => workshops().find(w => w.id === id);
const typeById = (id) => types().find(t => t.id === id);

// Text edits mutate without triggering a full view redraw (would drop input focus). Derived
// values (totals/clocks) are patched in place. Structural edits use structural() → full redraw.
let suppress = 0;
function mutate(fn) { suppress++; try { store.update(fn); } finally { suppress--; } }
function structural(fn) { store.update(fn); }
const guarded = (draw) => store.subscribe(() => { if (!suppress) draw(); });

// ============================================================ DASHBOARD
export function renderDashboard(view) {
  const draw = () => {
    clear(view);
    const list = workshops();
    view.appendChild(el('div.page-head', {}, [
      el('h1.page-title', {}, 'Workshops'),
      el('div.flex.gap', {}, [
        el('button.btn.ghost', { onclick: openTypeManager }, 'Manage types'),
        el('button.btn.primary', { onclick: createWorkshop }, '+ New workshop'),
      ]),
    ]));
    if (!list.length) {
      view.appendChild(el('div.empty', {}, 'No workshops yet. Create your first one to start planning.'));
      return;
    }
    const grid = el('div.card-grid');
    for (const w of list) grid.appendChild(workshopCard(w));
    view.appendChild(grid);
  };
  draw();
  return guarded(draw);
}

function workshopCard(w) {
  const items = (w.planItems || []).filter(p => p.kind !== 'section');
  const planned = items.reduce((s, p) => s + (Number(p.durationMin) || 0), 0);
  const slides = (w.planItems || []).reduce((s, p) => s + ((p.slides || []).length), 0);
  const target = Number(w.targetDurationMin) || 0;
  const over = target && planned > target;
  return el('div.card', {}, [
    el('h3.card-title', {}, w.title || 'Untitled workshop'),
    el('div.card-meta', {}, [
      el('div', {}, `📅 ${w.date || '—'}${w.startTime ? ' · ' + w.startTime : ''}`),
      el('div', { class: over ? 'over' : '' }, `⏱ ${fmtDuration(planned)}${target ? ' / ' + fmtDuration(target) : ''} planned`),
      el('div', {}, `${items.length} items · ${slides} slides`),
    ]),
    el('div.card-actions', {}, [
      el('a.btn.small.primary', { href: `#/w/${w.id}` }, 'Open'),
      el('button.btn.small.ghost', { onclick: () => duplicateWorkshop(w.id) }, 'Duplicate'),
      el('button.btn.small.danger-quiet', { onclick: () => deleteWorkshop(w.id) }, 'Delete'),
    ]),
  ]);
}

function createWorkshop() {
  const id = uid('w');
  structural(d => {
    d.workshops = d.workshops || [];
    d.workshops.unshift({
      id, title: 'Untitled workshop', topicSentence: '', audience: '',
      date: todayISO(), startTime: '09:00', targetDurationMin: 120, language: 'mixed',
      description: '', sources: [], planItems: [],
    });
  });
  location.hash = `#/w/${id}`;
}

function duplicateWorkshop(id) {
  const w = findWorkshop(id);
  if (!w) return;
  const copy = JSON.parse(JSON.stringify(w));
  copy.id = uid('w');
  copy.title = (w.title || 'Untitled') + ' (copy)';
  reId(copy);
  structural(d => { d.workshops.unshift(copy); });
}
function reId(w) {
  for (const p of w.planItems || []) { p.id = uid('pi'); for (const s of p.slides || []) s.id = uid('sl'); }
  for (const s of w.sources || []) s.id = uid('src');
}

function deleteWorkshop(id) {
  const w = findWorkshop(id);
  if (!w) return;
  confirmDialog(`Delete “${w.title || 'Untitled'}”? This can be restored from a snapshot.`, () => {
    structural(d => { d.workshops = d.workshops.filter(x => x.id !== id); });
    store.flush({ snapshot: `Before deleting ${w.title || 'workshop'}` });
  });
}

// ============================================================ PLANNER
let openItemId = null;   // inline-detail expansion (UI state, survives redraws)

export function renderPlanner(view, id) {
  const draw = () => {
    const w = findWorkshop(id);
    clear(view);
    if (!w) { view.appendChild(el('div.empty', {}, ['Workshop not found. ', el('a', { href: '#/' }, 'Back to list')])); return; }

    view.appendChild(el('div.page-head', {}, [
      el('a.back-link', { href: '#/' }, '← Workshops'),
      el('div.flex.gap', {}, [
        el('button.btn.ghost', { onclick: openTypeManager }, 'Manage types'),
        el('span.btn.small.disabled', { title: 'Slides arrive in Phase 2' }, 'Slides ▸'),
      ]),
    ]));

    const layout = el('div.planner-layout');
    layout.appendChild(plannerMain(w, draw));
    layout.appendChild(ideaSidebar(w, draw));
    view.appendChild(layout);
  };
  draw();
  return guarded(draw);
}

function plannerMain(w, draw) {
  const main = el('div.planner-main');
  main.appendChild(defineBlock(w));
  main.appendChild(sourcesBlock(w, draw));
  main.appendChild(runSheet(w, draw));
  return main;
}

// --- DEFINE block (FR-1.1) ---
function defineBlock(w) {
  const field = (label, key, opts = {}) => {
    const input = opts.type === 'area'
      ? el('textarea.def-input', { rows: opts.rows || 2 }, w[key] || '')
      : el('input.def-input', { type: opts.type || 'text', value: w[key] ?? '', placeholder: opts.ph || '' });
    input.addEventListener('input', () => mutate(() => { w[key] = opts.type === 'number' ? Number(input.value) : input.value; }));
    if (key === 'targetDurationMin' || key === 'startTime') input.classList.add('narrow');
    return el('label.def-field', {}, [el('span.def-label', {}, label), input]);
  };
  const langSel = el('select.def-input.narrow', {},
    [['mixed', 'EN + VN'], ['en', 'English'], ['vn', 'Vietnamese']].map(([v, t]) =>
      el('option', { value: v, selected: (w.language || 'mixed') === v }, t)));
  langSel.addEventListener('change', () => mutate(() => { w.language = langSel.value; }));

  return el('section.define', {}, [
    el('div.block-head', {}, 'DEFINE'),
    el('div.def-grid', {}, [
      field('Title', 'title', { ph: 'Workshop title' }),
      field('Topic in one sentence', 'topicSentence', { ph: 'What is this about?' }),
      field('Who is the audience?', 'audience', { type: 'area', ph: 'Counts, segments, roles…' }),
      el('div.def-row', {}, [
        field('Date', 'date', { type: 'date' }),
        field('Start', 'startTime', { type: 'time' }),
        field('Target (min)', 'targetDurationMin', { type: 'number' }),
        el('label.def-field', {}, [el('span.def-label', {}, 'Language'), langSel]),
      ]),
    ]),
  ]);
}

// --- Sources (FR-2.6) ---
function sourcesBlock(w, draw) {
  w.sources = w.sources || [];
  const body = el('div.sources-body');
  const rebuild = () => {
    clear(body);
    for (const s of w.sources) {
      const t = el('input.src-input', { value: s.title || '', placeholder: 'Title' });
      const u = el('input.src-input.grow', { value: s.url || '', placeholder: 'https://…' });
      t.addEventListener('input', () => mutate(() => { s.title = t.value; }));
      u.addEventListener('input', () => mutate(() => { s.url = u.value; }));
      body.appendChild(el('div.src-row', {}, [
        t, u,
        s.url ? el('a.src-open', { href: s.url, target: '_blank', rel: 'noopener' }, '↗') : el('span.src-open.muted', {}, '↗'),
        el('button.icon-btn', { title: 'Remove', onclick: () => { structural(() => { w.sources = w.sources.filter(x => x.id !== s.id); }); } }, '×'),
      ]));
    }
    body.appendChild(el('button.link.small', { onclick: () => structural(() => { w.sources.push({ id: uid('src'), url: '', title: '', note: '' }); }) }, '+ Add source'));
  };
  rebuild();
  return el('details.sources', { open: w.sources.length ? '' : null }, [
    el('summary', {}, `Sources & references (${w.sources.length})`),
    body,
  ]);
}

// --- Run-sheet (FR-2.x) ---
function runSheet(w, draw) {
  w.planItems = w.planItems || [];
  const clockRefs = new Map();      // itemId -> cell
  const subtotalRefs = new Map();   // sectionId -> cell
  let totalCell, deltaCell, endCell;

  const compute = () => scheduleOf(w);
  const patchDerived = () => {
    const sch = compute();
    for (const [pid, cell] of clockRefs) { const r = sch.rowMap.get(pid); if (r) cell.textContent = r.clock; }
    for (const [sid, cell] of subtotalRefs) { const s = sch.sectionMap.get(sid); if (s) cell.textContent = fmtDuration(s.subtotal); }
    if (totalCell) totalCell.textContent = fmtDuration(sch.total);
    if (endCell) endCell.textContent = sch.end;
    if (deltaCell) {
      const t = Number(w.targetDurationMin) || 0;
      deltaCell.textContent = t ? deltaText(sch.total, t) : '';
      deltaCell.className = 'total-delta ' + (t && sch.total > t ? 'over' : 'ok');
    }
  };

  const rowsWrap = el('div.sheet-rows');
  const sch = compute();
  w.planItems.forEach((p, idx) => {
    rowsWrap.appendChild(p.kind === 'section'
      ? sectionRow(w, p, idx, sch, subtotalRefs, patchDerived)
      : itemRow(w, p, idx, sch, clockRefs, patchDerived, draw));
  });
  rowsWrap.appendChild(endDropzone(w));

  totalCell = el('b.js-total', {}, fmtDuration(sch.total));
  endCell = el('b.js-end', {}, sch.end);
  const t = Number(w.targetDurationMin) || 0;
  deltaCell = el('b.total-delta', { class: t && sch.total > t ? 'over' : 'ok' }, t ? deltaText(sch.total, t) : '');

  return el('section.sheet', {}, [
    el('div.sheet-head', {}, [
      el('span.col-drag'), el('span.col-topic', {}, 'Topic — key ideas'),
      el('span.col-time', {}, 'Time'), el('span.col-type', {}, 'Type'), el('span.col-end'),
    ]),
    rowsWrap,
    el('div.sheet-toolbar', {}, [
      el('button.btn.small.ghost', { onclick: () => addItem(w, 'item') }, '+ Add item'),
      el('button.btn.small.ghost', { onclick: () => addItem(w, 'section') }, '+ Add section'),
    ]),
    el('div.totals', {}, [
      el('span.muted', {}, 'Section subtotals shown inline'),
      el('span', {}, ['Total ', totalCell, t ? ' / ' + fmtDuration(t) : '', ' · ', deltaCell, ' · ends ', endCell]),
    ]),
  ]);
}

function deltaText(total, target) {
  const d = total - target;
  if (d === 0) return 'on target';
  return d > 0 ? `${fmtDuration(d)} over` : `${fmtDuration(-d)} spare`;
}

// Running clock + section subtotals in one pass.
function scheduleOf(w) {
  const items = w.planItems || [];
  const rowMap = new Map(), sectionMap = new Map();
  let running = 0, total = 0, secN = 0;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (p.kind === 'section') {
      secN++;
      let sub = 0;
      for (let j = i + 1; j < items.length && items[j].kind !== 'section'; j++) sub += Number(items[j].durationMin) || 0;
      sectionMap.set(p.id, { subtotal: sub, number: secN, clock: addClock(w.startTime, running) });
    } else {
      rowMap.set(p.id, { clock: addClock(w.startTime, running) });
      const d = Number(p.durationMin) || 0;
      running += d; total += d;
    }
  }
  return { rowMap, sectionMap, total, end: addClock(w.startTime, total) };
}

function sectionRow(w, p, idx, sch, subtotalRefs, patchDerived) {
  const info = sch.sectionMap.get(p.id) || { number: '', subtotal: 0 };
  const title = el('input.sec-title', { value: p.title || '', placeholder: 'Section name' });
  title.addEventListener('input', () => mutate(() => { p.title = title.value; }));
  const sub = el('span.js-subtotal', {}, fmtDuration(info.subtotal));
  subtotalRefs.set(p.id, sub);
  const row = el('div.prow.section', { draggable: 'true', dataset: { idx, id: p.id } }, [
    dragHandle(),
    el('div.col-topic.flex', {}, [el('span.sec-num', {}, `${info.number}`), title]),
    el('span.col-time', {}, sub),
    el('span.col-type'),
    el('span.col-end', {}, [el('button.icon-btn', { title: 'Delete section', onclick: () => deleteItem(w, p.id) }, '×')]),
  ]);
  wireDrag(w, row);
  return row;
}

function itemRow(w, p, idx, sch, clockRefs, patchDerived, draw) {
  const info = sch.rowMap.get(p.id) || { clock: '' };
  const title = el('input.item-title', { value: p.title || '', placeholder: 'Topic / question' });
  title.addEventListener('input', () => mutate(() => { p.title = title.value; }));

  const dur = el('input.dur-input', { type: 'number', min: '0', value: p.durationMin ?? '' });
  dur.addEventListener('input', () => { mutate(() => { p.durationMin = Number(dur.value); }); patchDerived(); });

  const typeSel = buildTypeSelect(p.typeId, (val) => structural(() => { p.typeId = val; }));

  const clock = el('span.clock', {}, info.clock);
  clockRefs.set(p.id, clock);

  const slideCount = (p.slides || []).length;
  const detailToggle = el('button.detail-toggle', {
    class: openItemId === p.id ? 'open' : '',
    onclick: () => { openItemId = openItemId === p.id ? null : p.id; draw(); },
  }, openItemId === p.id ? '▾ details' : '▸ details');

  const row = el('div.prow.item', { draggable: 'true', dataset: { idx, id: p.id } }, [
    dragHandle(),
    el('div.col-topic', {}, [
      el('div.item-titlerow', {}, [title]),
      el('div.item-sub', {}, [
        clock, ' · ', detailToggle,
        el('span.slide-badge', { class: slideCount ? '' : 'muted', title: 'Attached slides (Phase 2)' }, slideCount ? `▦ ${slideCount}` : '▦ —'),
        p.bankRef ? el('span.bank-tag', { title: 'From idea bank' }, '★') : null,
      ]),
    ]),
    el('span.col-time', {}, dur),
    el('span.col-type', {}, typeSel),
    el('span.col-end', {}, [el('button.icon-btn', { title: 'Delete item', onclick: () => deleteItem(w, p.id) }, '×')]),
  ]);
  wireDrag(w, row);

  const rowWrap = el('div.prow-wrap', {}, [row]);
  if (openItemId === p.id) rowWrap.appendChild(itemDetail(w, p, draw));
  return rowWrap;
}

function itemDetail(w, p, draw) {
  const keyIdeas = el('textarea.detail-area', { rows: 3, placeholder: 'Key ideas / facilitation notes (markdown)…' }, p.keyIdeas || '');
  keyIdeas.addEventListener('input', () => mutate(() => { p.keyIdeas = keyIdeas.value; }));
  const materials = el('input.detail-input', { value: p.materials || '', placeholder: 'Materials' });
  materials.addEventListener('input', () => mutate(() => { p.materials = materials.value; }));

  // source refs as checkboxes over workshop sources
  p.sourceRefs = p.sourceRefs || [];
  const srcBox = el('div.detail-sources');
  if ((w.sources || []).length) {
    for (const s of w.sources) {
      const cb = el('input', { type: 'checkbox', checked: p.sourceRefs.includes(s.id) });
      cb.addEventListener('change', () => mutate(() => {
        p.sourceRefs = cb.checked ? [...new Set([...p.sourceRefs, s.id])] : p.sourceRefs.filter(x => x !== s.id);
      }));
      srcBox.appendChild(el('label.src-check', {}, [cb, el('span', {}, s.title || s.url || 'source')]));
    }
  } else {
    srcBox.appendChild(el('span.muted.small', {}, 'No workshop sources yet — add them above.'));
  }

  return el('div.item-detail', {}, [
    el('label.detail-field', {}, [el('span.detail-label', {}, 'Key ideas'), keyIdeas]),
    el('div.detail-row', {}, [
      el('label.detail-field.grow', {}, [el('span.detail-label', {}, 'Materials'), materials]),
    ]),
    el('label.detail-field', {}, [el('span.detail-label', {}, 'Sources'), srcBox]),
    el('div.detail-actions', {}, [
      el('button.link.small', { onclick: () => saveToBank(p) }, '★ Save to idea bank'),
      el('span.detail-slides muted small', {}, 'Slides for this item — coming in Phase 2'),
    ]),
  ]);
}

function buildTypeSelect(current, onChange) {
  const sel = el('select.type-select');
  sel.appendChild(el('option', { value: '' }, '— type —'));
  const groups = { segment: 'Segments', activity: 'Activities', structural: 'Structural' };
  for (const cat of Object.keys(groups)) {
    const og = el('optgroup', { label: groups[cat] });
    for (const t of types().filter(x => x.category === cat)) {
      og.appendChild(el('option', { value: t.id, selected: t.id === current }, t.name));
    }
    if (og.children.length) sel.appendChild(og);
  }
  if (current && !typeById(current)) sel.appendChild(el('option', { value: current, selected: true }, current));
  const t = typeById(current);
  if (t) { sel.style.borderColor = t.color; sel.style.color = t.color; }
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function addItem(w, kind) {
  const p = kind === 'section'
    ? { id: uid('pi'), kind: 'section', title: 'New section' }
    : { id: uid('pi'), kind: 'item', typeId: '', title: '', keyIdeas: '', durationMin: 5, materials: '', sourceRefs: [], bankRef: null, slides: [] };
  structural(() => { w.planItems.push(p); });
  if (kind === 'item') openItemId = p.id;
}

function deleteItem(w, id) {
  structural(() => { w.planItems = w.planItems.filter(p => p.id !== id); });
}

// --- drag reorder (FR-2.4). Dragging a section moves its whole block. ---
let dragId = null;
function dragHandle() { return el('span.drag', { title: 'Drag to reorder' }, '⠿'); }

function blockIds(w, id) {
  const items = w.planItems;
  const i = items.findIndex(p => p.id === id);
  if (i < 0) return [];
  if (items[i].kind !== 'section') return [id];
  const ids = [id];
  for (let j = i + 1; j < items.length && items[j].kind !== 'section'; j++) ids.push(items[j].id);
  return ids;
}

function wireDrag(w, row) {
  row.addEventListener('dragstart', (e) => { dragId = row.dataset.id; e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
  row.addEventListener('dragend', () => { dragId = null; row.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over')); });
  row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', (e) => {
    e.preventDefault(); row.classList.remove('drag-over');
    reorder(w, dragId, row.dataset.id);
  });
}

function endDropzone(w) {
  const z = el('div.end-dropzone');
  z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('drag-over'); });
  z.addEventListener('dragleave', () => z.classList.remove('drag-over'));
  z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('drag-over'); reorder(w, dragId, null); });
  return z;
}

function reorder(w, draggedId, targetId) {
  if (!draggedId) return;
  const block = blockIds(w, draggedId);
  if (targetId && block.includes(targetId)) return;      // dropping inside itself
  structural(() => {
    const items = w.planItems;
    const moving = items.filter(p => block.includes(p.id));
    const rest = items.filter(p => !block.includes(p.id));
    let at = targetId ? rest.findIndex(p => p.id === targetId) : rest.length;
    if (at < 0) at = rest.length;
    rest.splice(at, 0, ...moving);
    w.planItems = rest;
  });
}

// ============================================================ IDEA BANK
let bankFilter = '';
let bankTag = '';

function ideaSidebar(w, draw) {
  const side = el('aside.idea-side');
  const search = el('input.bank-search', { value: bankFilter, placeholder: '🔎 search idea bank' });
  search.addEventListener('input', () => { bankFilter = search.value; rebuild(); });
  const listWrap = el('div.bank-list');
  const rebuild = () => {
    clear(listWrap);
    for (const b of filteredBank()) listWrap.appendChild(bankCardMini(b, w));
    if (!filteredBank().length) listWrap.appendChild(el('div.muted.small', {}, 'No matches.'));
  };
  rebuild();
  side.append(
    el('div.side-head', {}, [el('h4', {}, 'Idea bank'), el('a.link.small', { href: '#/bank' }, 'Manage →')]),
    search, listWrap,
  );
  return side;
}

function filteredBank() {
  const q = bankFilter.trim().toLowerCase();
  return bank().filter(b => {
    if (bankTag && !(b.tags || []).includes(bankTag)) return false;
    if (!q) return true;
    return (b.title || '').toLowerCase().includes(q)
      || (b.description || '').toLowerCase().includes(q)
      || (b.tags || []).some(t => t.includes(q));
  });
}

function bankCardMini(b, w) {
  const t = typeById(b.typeId);
  return el('div.bank-item', {}, [
    el('div.bank-item-head', {}, [
      el('b', {}, b.title),
      t ? el('span.chip', { style: `border-color:${t.color};color:${t.color}` }, catShort(t.category)) : null,
    ]),
    el('div.bank-item-meta muted small', {}, `${b.typicalDurationMin || '?'}m · ${b.groupSize || 'any'}`),
    el('button.btn.small.ghost.block', { onclick: () => addFromBank(w, b) }, '+ Add to plan'),
  ]);
}
const catShort = (c) => c === 'activity' ? 'A' : c === 'structural' ? 'S' : 'S';

// FR-3.3 — insert a plan item pre-filled from a bank entry (a COPY; keeps bankRef provenance).
function addFromBank(w, b) {
  const p = {
    id: uid('pi'), kind: 'item', typeId: b.typeId || '',
    title: b.title || '', keyIdeas: b.description || '',
    durationMin: Number(b.typicalDurationMin) || 5,
    materials: b.materials || '', sourceRefs: [], bankRef: b.id, slides: [],
  };
  structural(() => { w.planItems.push(p); });
  openItemId = p.id;
}

function saveToBank(p) {
  const entry = {
    id: uid('bank'), title: p.title || 'Untitled activity', typeId: p.typeId || '',
    description: p.keyIdeas || '', typicalDurationMin: Number(p.durationMin) || 0,
    groupSize: 'any', materials: p.materials || '', tags: [], sources: [], suggestedTemplates: [],
  };
  structural(d => { d.ideaBank = d.ideaBank || []; d.ideaBank.unshift(entry); });
  toast('Saved to idea bank ★');
}

// Full idea-bank management view (#/bank)
export function renderBank(view) {
  const draw = () => {
    clear(view);
    view.appendChild(el('div.page-head', {}, [
      el('h1.page-title', {}, 'Idea bank'),
      el('button.btn.primary', { onclick: () => editBankEntry(null) }, '+ New activity'),
    ]));
    const allTags = [...new Set(bank().flatMap(b => b.tags || []))].sort();
    const filters = el('div.bank-filters', {}, [
      chipToggle('All', !bankTag, () => { bankTag = ''; draw(); }),
      ...allTags.map(tag => chipToggle(tag, bankTag === tag, () => { bankTag = bankTag === tag ? '' : tag; draw(); })),
    ]);
    const search = el('input.bank-search.wide', { value: bankFilter, placeholder: '🔎 search' });
    search.addEventListener('input', () => { bankFilter = search.value; grid.replaceWith(buildGrid()); grid = document.querySelector('.bank-grid'); });
    view.appendChild(el('div.bank-controls', {}, [search, filters]));
    let grid = buildGrid();
    view.appendChild(grid);
  };
  const buildGrid = () => {
    const grid = el('div.bank-grid');
    for (const b of filteredBank()) grid.appendChild(bankCardFull(b));
    if (!filteredBank().length) grid.appendChild(el('div.muted', {}, 'No matches.'));
    return grid;
  };
  draw();
  return guarded(draw);
}

function bankCardFull(b) {
  const t = typeById(b.typeId);
  return el('div.card.bank-card', {}, [
    el('div.flex.between', {}, [
      el('h3.card-title', {}, b.title),
      t ? el('span.chip', { style: `border-color:${t.color};color:${t.color}` }, t.name) : null,
    ]),
    el('div.card-meta small', {}, `${b.typicalDurationMin || '?'} min · ${b.groupSize || 'any'}${b.materials ? ' · ' + b.materials : ''}`),
    el('p.bank-desc', {}, b.description || ''),
    (b.tags || []).length ? el('div.tag-row', {}, b.tags.map(t2 => el('span.tag', {}, t2))) : null,
    el('div.card-actions', {}, [
      el('button.btn.small.ghost', { onclick: () => editBankEntry(b.id) }, 'Edit'),
      el('button.btn.small.ghost', { onclick: () => duplicateBank(b.id) }, 'Duplicate'),
      el('button.btn.small.danger-quiet', { onclick: () => deleteBank(b.id) }, 'Delete'),
    ]),
  ]);
}

function duplicateBank(id) {
  const b = bank().find(x => x.id === id); if (!b) return;
  const copy = JSON.parse(JSON.stringify(b)); copy.id = uid('bank'); copy.title = b.title + ' (copy)';
  structural(d => { d.ideaBank.unshift(copy); });
}
function deleteBank(id) {
  confirmDialog('Delete this idea bank entry?', () => structural(d => { d.ideaBank = d.ideaBank.filter(x => x.id !== id); }));
}

function editBankEntry(id) {
  const existing = id ? bank().find(b => b.id === id) : null;
  const draft = existing ? JSON.parse(JSON.stringify(existing))
    : { id: uid('bank'), title: '', typeId: '', description: '', typicalDurationMin: 15, groupSize: 'any', materials: '', tags: [], sources: [], suggestedTemplates: [] };
  const f = (label, node) => el('label.detail-field', {}, [el('span.detail-label', {}, label), node]);
  const title = el('input.detail-input', { value: draft.title });
  const dur = el('input.detail-input.narrow', { type: 'number', min: '0', value: draft.typicalDurationMin });
  const group = el('input.detail-input.narrow', { value: draft.groupSize });
  const materials = el('input.detail-input', { value: draft.materials });
  const desc = el('textarea.detail-area', { rows: 3 }, draft.description);
  const tags = el('input.detail-input', { value: (draft.tags || []).join(', '), placeholder: 'comma, separated, tags' });
  const typeSel = buildTypeSelect(draft.typeId, v => { draft.typeId = v; });

  modal(existing ? 'Edit activity' : 'New activity', el('div.form', {}, [
    f('Title', title),
    el('div.detail-row', {}, [f('Type', typeSel), f('Duration (min)', dur), f('Group size', group)]),
    f('Materials', materials),
    f('How it runs', desc),
    f('Tags', tags),
  ]), {
    onSave: () => {
      draft.title = title.value.trim() || 'Untitled activity';
      draft.typicalDurationMin = Number(dur.value) || 0;
      draft.groupSize = group.value; draft.materials = materials.value;
      draft.description = desc.value; draft.tags = tags.value.split(',').map(s => s.trim()).filter(Boolean);
      structural(d => {
        d.ideaBank = d.ideaBank || [];
        const i = d.ideaBank.findIndex(b => b.id === draft.id);
        if (i >= 0) d.ideaBank[i] = draft; else d.ideaBank.unshift(draft);
      });
    },
  });
}

// ============================================================ TYPE MANAGER (FR-2.5)
function openTypeManager() {
  const body = el('div.type-manager');
  const rebuild = () => {
    clear(body);
    for (const t of types()) body.appendChild(typeRow(t, rebuild));
    body.appendChild(el('button.link.small', {
      onclick: () => { structural(d => { d.planItemTypes.push({ id: uid('type'), name: 'New type', category: 'activity', color: '#4a7c59' }); }); rebuild(); },
    }, '+ Add type'));
  };
  rebuild();
  modal('Manage item types', body, { wide: true, saveLabel: 'Done' });
}

function typeRow(t, rebuild) {
  const name = el('input.detail-input.grow', { value: t.name });
  name.addEventListener('input', () => mutate(() => { t.name = name.value; }));
  const cat = el('select.detail-input.narrow', {}, [['segment', 'Segment'], ['activity', 'Activity'], ['structural', 'Structural']]
    .map(([v, l]) => el('option', { value: v, selected: t.category === v }, l)));
  cat.addEventListener('change', () => mutate(() => { t.category = cat.value; }));
  const color = el('input', { type: 'color', value: t.color || '#888888' });
  color.addEventListener('input', () => { mutate(() => { t.color = color.value; }); swatch.style.background = color.value; });
  const swatch = el('span.type-swatch', { style: `background:${t.color}` });
  return el('div.type-row', {}, [
    swatch, name, cat, color,
    el('button.icon-btn', {
      title: 'Delete', onclick: () => {
        const used = workshops().some(w => (w.planItems || []).some(p => p.typeId === t.id));
        const go = () => { structural(d => { d.planItemTypes = d.planItemTypes.filter(x => x.id !== t.id); }); rebuild(); };
        if (used) confirmDialog(`“${t.name}” is used by some items. Delete it anyway? Those items will show no type.`, go);
        else go();
      },
    }, '×'),
  ]);
}

// ============================================================ MODAL / DIALOG / TOAST
function modal(title, contentNode, opts = {}) {
  const overlay = el('div.modal-overlay');
  const close = () => overlay.remove();
  const footer = el('div.modal-foot', {}, [
    opts.onSave ? el('button.btn.ghost', { onclick: close }, 'Cancel') : null,
    el('button.btn.primary', {
      onclick: () => { if (opts.onSave) opts.onSave(); close(); },
    }, opts.saveLabel || (opts.onSave ? 'Save' : 'Close')),
  ]);
  overlay.appendChild(el('div.modal', { class: opts.wide ? 'wide' : '' }, [
    el('div.modal-head', {}, [el('h3', {}, title), el('button.icon-btn', { onclick: close }, '×')]),
    el('div.modal-body', {}, contentNode),
    footer,
  ]));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  return { close };
}

function confirmDialog(message, onYes) {
  const overlay = el('div.modal-overlay');
  const close = () => overlay.remove();
  overlay.appendChild(el('div.modal', {}, [
    el('div.modal-body', {}, el('p', {}, message)),
    el('div.modal-foot', {}, [
      el('button.btn.ghost', { onclick: close }, 'Cancel'),
      el('button.btn.danger', { onclick: () => { onYes(); close(); } }, 'Delete'),
    ]),
  ]));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
}

function chipToggle(label, active, onClick) {
  return el('button.filter-chip', { class: active ? 'active' : '', onclick: onClick }, label);
}

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('div.toast'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
