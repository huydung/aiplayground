# HDI Workshop Studio — Development Roadmap

Phased plan for AI-agent execution. Each phase is independently shippable and testable. Read [PRD.md](PRD.md) first — section references (§, FR-, R) point there.

## How to work on this (read before every phase)

- **Context to load**: this file + PRD.md + repo `CLAUDE.md`/`AGENTS.md`. Patterns to copy are always named per task — do not invent new patterns.
- **Conventions**: no build step, vanilla ES modules, direct pushes to `main` (per CLAUDE.md), CDN deps only via esm.sh with graceful fallback, one new npm dep total (`@anthropic-ai/sdk`, Phase 3).
- **Tracking**: update `DEV-TRACKER.xlsx` — set task Status as you go, run the phase's Testing rows before calling it done.
- **Definition of done per phase**: all acceptance criteria pass via the manual test script, `npm run dev` clean, deployed-safe (no crash when env vars missing), homepage card works.
- **IDs**: development tasks `D<phase>.<n>`, test cases `T<phase>.<n>` — same IDs in the tracker.

---

## Phase 1 — Accounts, planner, idea bank

**Goal:** plan a workshop end-to-end (DEFINE block + run-sheet + idea bank), cross-device safe. The app is already useful with zero slides.

| ID | Task | Files | Notes |
|---|---|---|---|
| D1.1 | Router with auth + blob sync | `tools/workshop.js` | Copy `tools/poker.js` wholesale: users/user_data/user_snapshots schema, `requireAuth`, signup/login (bcrypt 12, dummy-hash timing guard), rev'd GET/PUT `/data` with 409+authoritative-state, snapshots. Strip poker-specific bits. |
| D1.2 | Frontend scaffold + brand chrome | `static/workshop/index.html`, `styles.css`, `src/api.js` | Hash-route SPA shell. Brand vars `--hdi-bright:#BD0129 --hdi-deep:#8E011F --hdi-dark:#51000C`, Merriweather + Be Vietnam Pro (Google Fonts), logo `static/assets/hdi-logo-transparent.png`. Layout conventions from `static/systems-explorer/`. |
| D1.3 | Sync store | `src/store.js` | Vanilla port of the DataProvider in `static/hdpg-poker.html` (~lines 3186–3330): localStorage cache seed → server truth, 800 ms debounced PUT, flush on `pagehide` (`keepalive`), adopt-server-on-409, refetch on focus. |
| D1.4 | Auth screens | `src/planner.js` (or `auth.js`) | Login/signup forms against `/api/workshop/{login,signup}`; JWT in localStorage. |
| D1.5 | Seeds module + merge | `src/seeds.js` | `planItemTypes` (FR-2.5 list), `ideaBank` (PRD Appendix A, all ~34 entries), `interactionTemplates` (Appendix C; used Phase 4), `seedVersion` merge logic (§4.2). Slide templates land in Phase 2. |
| D1.6 | Dashboard + DEFINE block | `src/planner.js` | Workshop cards (FR-1.2); create/duplicate/delete (snapshot before delete); DEFINE form (FR-1.1). |
| D1.7 | Run-sheet | `src/planner.js` | Ordered items, section rows, type badges with taxonomy colors, inline edit of title/duration/type, item detail panel (keyIdeas markdown textarea, materials, sources), HTML5 drag reorder (sections move their block), timing math live (FR-2.3: section subtotals, total vs target delta, clock times). |
| D1.8 | Item type manager | `src/planner.js` | CRUD list editor for `planItemTypes` (name, category S/A/structural, color). |
| D1.9 | Idea bank UI | `src/planner.js` | Browse/search/filter, CRUD+duplicate, "Add to plan" (pre-filled item, keeps `bankRef`), "Save to bank" from an item. |
| D1.10 | Homepage card | `static/index.html` | Card linking to `/workshop/`, matching existing card markup. |

**Acceptance criteria**
- T1.1 Sign up, log out, log back in; wrong password rejected; duplicate username → 409.
- T1.2 Create a workshop with full DEFINE block; reload → persists; open on a second browser/profile → same state.
- T1.3 Two tabs open, edit in both: the stale tab gets 409-handled (adopts server state, no data lost, no crash).
- T1.4 Run-sheet: add 2 sections + 6 items with durations/types; section subtotals, total, and over/under-target delta all correct; item clock times follow workshop start time.
- T1.5 Drag an item to another section and a section above another: order + subtotals update; state persists after reload.
- T1.6 Add a custom item type with a color; it appears in the dropdown and badges its rows.
- T1.7 Idea bank shows seeded entries; search "brainwriting" finds it; "Add to plan" inserts a pre-filled item; edit the bank entry → the already-inserted plan item is unchanged (copy, not reference).
- T1.8 Kill the tab mid-edit (within the debounce window) → change survives (pagehide flush).

**Manual test script:** run `npm run dev`, execute T1.1–T1.8 in order in Chrome; T1.2 uses a second browser profile.

---

## Phase 2 — Template registry, renderer, deck player, print

**Goal:** attach slides to plan items, present them, print them. De-risks the renderer contract before any AI. **Deliverable includes `docs/workshop/renderer-contract.md`** — the human/AI-shared spec (§4.4).

| ID | Task | Files | Notes |
|---|---|---|---|
| D2.1 | Renderer | `src/renderer.js` | Full §4.4 pipeline: `{{key}}` substitution (escape text, `marked` via esm.sh for markdown w/ plain-text fallback), `data-list` repetition, computed context (`_item`, `_section`, `_workshop`, `_agenda`, `_slideIndex/Count`), `data-step` + `data-step="auto"`, CSS scoping under `[data-template=id]`, JS hook loader (`onRender/onStep/onResults/onDestroy`). |
| D2.2 | Built-in slide templates | `src/seeds.js` | The 13 non-interactive templates from PRD Appendix B (#1–11, 18; interactive ones in Phase 4; custom-html in Phase 5). Each authored + previewed by hand. |
| D2.3 | Renderer contract doc | `docs/workshop/renderer-contract.md` | Write while building D2.1 — it becomes the Phase 3 prompt verbatim. Template shape, field types, pipeline rules, hook API, worked example. |
| D2.4 | Slide CRUD + attachment flow | `src/editor.js` | Left rail = plan items with slide thumbnails grouped under each; create-slide requires picking an item **or creating one in the same dialog** (FR-5.1); reorder slides within an item; delete item → prompt delete/re-attach slides (FR-5.3). |
| D2.5 | Field-form editor + preview | `src/editor.js` | Form generated from field schema (text/markdown/number/select/image/list editors), live preview via renderer, speaker-notes field. |
| D2.6 | Template manager | `src/templates.js` | List w/ builtin badges, duplicate, create/edit: field-schema builder + HTML/CSS/JS tabs (CodeMirror 6 lazy from esm.sh, textarea fallback) + live preview with sample data; editing re-renders dependent slides (FR-4.3); builtin delete = hide + restorable. |
| D2.7 | Deck player, present mode | `present.html`, `src/player.js` | Deck = flatten(items→slides); slide letterboxed to the largest 16:9 fit, **all chrome hidden by default** — overlays revealed only by hotkey or pointer in the top/bottom edge band (NOT general mouse move), auto-hide ~3 s, pinnable (FR-6.1/6.1b); keyboard nav, deterministic slide+step state, per-item countdown timer w/ overrun red, schedule bar, notes drawer, overview grid (Esc). |
| D2.8 | Read/print mode | `player.js`, `styles.css` | `?mode=read`: linear, section/item headings, all steps expanded, print CSS (page per slide, headers/footers), `R` toggles modes. |

**Acceptance criteria**
- T2.1 Every built-in template renders correctly in editor preview with sample data (visual check, all 13).
- T2.2 Create-slide flow cannot produce an orphan: both paths (attach to existing / create new item inline) work.
- T2.3 A `tpl_bullets` slide with 4 bullets: present mode reveals one per keypress; ← steps back; jumping to the slide from the overview grid lands with correct step state.
- T2.4 Reorder plan items → deck order follows immediately (verify in overview grid). Retime an item → its `tpl_instructions` slide shows the new duration without touching the slide.
- T2.5 Timer counts down from the item's duration, turns red on overrun, resets on slide-group change.
- T2.6 Read mode: all reveals expanded, headings between item groups; Chrome print preview → one slide per page, no clipped content; save as PDF and open it.
- T2.7 Duplicate a builtin template, change its CSS, save → only slides using the copy change; edit a template's HTML → all its slides re-render.
- T2.8 Agenda slide reflects live plan sections + subtotals; changes to the plan appear on next render.
- T2.9 Present mode default is chrome-free: open fresh → only the slide, letterboxed 16:9 (black bars), in windows of several aspect ratios; moving the pointer across the middle of the slide reveals nothing; `T`/`N` or moving into the top/bottom edge reveals overlays which auto-hide ~3 s after the pointer leaves the edge; a pinned timer stays.

**Manual test script:** build a real mini-workshop (2 sections, 5 items, 8 slides across ≥ 6 templates), run it start-to-finish in present mode, then print it.

---

## Phase 3 — AI generation

**Goal:** describe slides per plan item → Claude fills templates; describe a template → Claude drafts it. App remains fully usable without an API key.

| ID | Task | Files | Notes |
|---|---|---|---|
| D3.1 | SDK + config | `package.json`, `tools/workshop.js` | `npm i @anthropic-ai/sdk`; `ANTHROPIC_API_KEY` env (Fly: `fly secrets set`); model const `claude-sonnet-5`; no `temperature`; `max_tokens` 16000; missing key → 503 JSON `{error:"ai_unavailable"}`. |
| D3.2 | `POST /generate-slides` | `tools/workshop.js` | §4.5 prompt assembly: stable prefix (renderer-contract.md + brand fragment) with `cache_control` breakpoint; variable part = DEFINE block + plan item + target templates' field schemas + instruction. Structured output → validate each slide against its schema, one retry on failure. Log to `ai_generations`; enforce daily cap (100) → 429. |
| D3.3 | `POST /generate-template` | `tools/workshop.js` | Description → template JSON (shape-validated only; human previews before save). |
| D3.4 | Generation dialog | `src/editor.js` | Per plan item: slide count, template select per slide, instruction box → progress → review list with per-slide accept / regenerate-with-refinement; accepted slides append to the item (attachment automatic). |
| D3.5 | Edit-via-prompt | `src/editor.js` | On an existing slide: instruction + current fields → revised fields → diff-style before/after preview → apply/discard. |
| D3.6 | Template generation UI + usage display | `src/templates.js` | "Generate with AI" entry in template manager → draft opens in the editor (not saved until user saves). Usage: current-month spend estimate + today's count from a small `GET /usage` (auth'd) endpoint. |

**Acceptance criteria**
- T3.1 With no API key set: generation UI shows a clear "AI unavailable" state; everything else works.
- T3.2 Generate 3 slides (bullets, big-number, debrief) for a real plan item: all validate against their schemas, render without hand-fixing, respect workshop language (test once with Vietnamese content).
- T3.3 Regenerate one slide with a refinement instruction → only that slide changes; accept → attached to the right item in order.
- T3.4 Edit-via-prompt changes exactly the requested aspect of a slide's fields.
- T3.5 Generate a template ("myth vs fact two-panel with reveal") → draft previews with sample data → save → usable on a new slide.
- T3.6 Daily cap: set cap to 2 (test override), third call → 429 surfaced politely in UI. Token counts land in `ai_generations`; usage endpoint sums match.

**Manual test script:** T3.1 first (unset key), then set key and run T3.2–T3.6 against the dev server.

---

## Phase 4 — Participant interaction

**Goal:** phones join a live session; polls/word clouds/ratings/hotspots update the projected slide ≤ 2 s.

| ID | Task | Files | Notes |
|---|---|---|---|
| D4.1 | Session tables + endpoints | `tools/workshop.js` | §4.2 DDL (`live_sessions`, `responses`) + §4.3 endpoints; publish interactions snapshot at session start (FR-8.5); payload validation + size caps + per-participant rate limit (§5); join-code alphabet unambiguous (no 0/O/1/I). |
| D4.2 | Participant page | `join.html`, `src/participant.js` | Mobile-first; `?c=CODE`; localStorage participant id; 2 s poll of `GET /sessions/:code`; native input UIs for the 4 kinds (Appendix C); submitted/waiting states; re-vote allowed while active. |
| D4.3 | Interactive slide templates | `src/seeds.js`, `renderer.js` | Appendix B #12–17 (`tpl_quiz`, `tpl_poll`, `tpl_wordcloud`, `tpl_rating`, `tpl_hotspot`, `tpl_qa_wall`) with `onResults` hooks: bars, word cloud (frequency-scaled text, stop-words trimmed), avg+distribution, dot overlay, cards. `interaction` field type UI in the slide editor (pick preset, edit question/options). |
| D4.4 | Player session controls | `src/player.js` | Start/end session, QR (tiny esm.sh QR lib or inline generator) + code badge, auto-offer activation when an interactive slide shows, results polling pushed into the slide via `onResults`, reveal step for quiz correct answers. |
| D4.5 | Load-test script | `scripts/workshop-participant-sim.js` | Node script: N simulated participants (default 30) join + respond over ~30 s; assert 2xx and final counts. |

**Acceptance criteria**
- T4.1 Start session → QR + code on the player; phone (real device) joins without login.
- T4.2 Poll slide: activate → phone shows options; vote → bar updates on the projector within 2 s; re-vote replaces (total count unchanged); deactivate → phone shows waiting, results freeze.
- T4.3 Word cloud: 3+ phones submit; cloud scales by frequency; stop-words don't dominate; XSS probe (`<img onerror>` as submission) renders as inert text (R2 — text nodes only).
- T4.4 Quiz: votes hidden until reveal step; reveal shows distribution + highlights correct.
- T4.5 Rating and hotspot kinds work end-to-end on a phone.
- T4.6 Facilitator edits the workshop mid-session → live session unaffected (snapshot isolation).
- T4.7 `node scripts/workshop-participant-sim.js 30` → zero errors, counts correct; player stays smooth.
- T4.8 Ended session's join page says "session ended"; results still visible in read mode.

**Manual test script:** two laptops + two phones on the dev URL; run T4.1–T4.8; finish with the sim script.

---

## Phase 5 — Polish (optional, pick per value)

| ID | Task | Notes |
|---|---|---|
| D5.1 | `tpl_custom_html` escape hatch | Sandboxed `<iframe sandbox="allow-scripts">`, mode/step via postMessage (§4.4.7). |
| D5.2 | CSV export of session responses | `GET /sessions/:code/export` (auth) → CSV; addresses R7. |
| D5.3 | Workshop JSON export/import | Blob-slice download/upload, systems-explorer `downloadJson` pattern. |
| D5.4 | Paste-from-Sheets import (Q2) | Paste TSV rows (Topic / Key Ideas / Time / Type) → parsed into plan items with type mapping preview. High migration value. |
| D5.5 | `/j/:code` short URL | One redirect line in `server.js`. |
| D5.6 | Session-end snapshot UI | Browse/restore `user_snapshots` (endpoint already exists). |

**Acceptance criteria:** per-task, defined when scheduled; each lands with its own test row in the tracker.

---

## Dependency notes

- Phase 2 depends on 1 (store, seeds); Phase 3 depends on 2 (renderer contract is the prompt); Phase 4 depends on 2 (renderer hooks), not on 3.
- Phases 3 and 4 are independent of each other — either order works; 4-before-3 if a real workshop needs polls sooner.
