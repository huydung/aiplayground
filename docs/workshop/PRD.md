# HDI Workshop Studio — Product Requirements Document

| | |
|---|---|
| **Status** | Approved for development |
| **Owner** | Dave (Hung Dung Nguyen) |
| **Date** | 2026-07-08 |
| **Route / DB** | `/api/workshop` · `static/workshop/` · `data/workshop.sqlite` |
| **Companion docs** | [ROADMAP.md](ROADMAP.md) · [WIREFRAMES.html](WIREFRAMES.html) · [DEV-TRACKER.xlsx](DEV-TRACKER.xlsx) |

## 1. Overview

### 1.1 Problem

Dave designs and runs professional training workshops (bilingual EN/VN). Today the plan lives in Google Sheets (a DEFINE block + a timed run-sheet of "beats" with a Type dropdown), and slides are built separately by hand. The two constantly drift: retiming or reordering the plan means manually reworking the deck; activity ideas are scattered across sheets and memory; interactive moments (polls, word clouds) need a third-party tool.

### 1.2 Product

**HDI Workshop Studio** — one web app covering the workshop lifecycle:

1. **Plan** — a structured run-sheet (sections → timed items with types), an idea bank of reusable activities, and source/reference tracking.
2. **Slides, synchronized** — every slide is *attached to a plan item*. The deck's order is derived from the plan; reordering the plan reorders the deck. Slides are structured content (template + fields), rendered by a template registry the user can extend. AI (Claude API) fills templates with content and can generate new templates.
3. **Run** — present mode (step reveals, per-item timers, speaker notes) and read/print mode (linear, everything expanded, browser print → PDF), plus live participant interaction (phones join via code: polls, word clouds, ratings, hotspots).

### 1.3 Goals

- One source of truth: change the plan, the deck follows. No drift.
- Slide details are tweakable as **form fields / markdown**, not raw code.
- Templates (slide + interaction + item types) are data: add / edit / remove / duplicate.
- Print-quality handout from the same content that projects.
- Runs on the existing aiplayground stack: Express + better-sqlite3 + vanilla ES modules, no build step, deployed on Fly.io app `hdi`.

### 1.4 Non-goals (v1)

- Multi-editor collaboration on one workshop (accounts exist, but one author per workshop).
- Offline-first presenting (present mode requires the server only for participant features; slides themselves render from the already-loaded blob).
- App chrome localization — UI is English; **content** is freely bilingual (Be Vietnam Pro handles diacritics).
- PowerPoint import/export.

## 2. Personas & core use cases

| Persona | Context | Needs |
|---|---|---|
| **Facilitator (Dave)** — primary | Designs at desk, presents at venue (often a different machine), reviews on the go | Fast structured planning, timing math done for him, deck always matching the plan, printable handout, live audience input |
| **Co-trainer** — secondary | Has own account | Same features, own workshops |
| **Participant** | Phone, no account, 30–90 seconds of patience | Scan QR → answer → see results on the big screen |

**Use case walkthrough (happy path):**

1. Create workshop → fill DEFINE block: title, topic-in-one-sentence, audience profile, date/time, target duration (e.g. 120 min).
2. Build the run-sheet: sections ("Introduction — 23 min") containing typed, timed items ("Hook — the Sergey Brin interview question, 3 min, `S: CTA/Hook`"). Pull proven activities from the idea bank. Running totals per section and vs. target update live.
3. For each item, describe the slides wanted (count + template each + instruction) → AI generates slide content into the chosen templates → review, accept, tweak fields.
4. Present at venue: open present URL, full-screen; timers track the plan; audience joins a live session by QR for the poll slides.
5. After (or before, as pre-reading): switch to read mode, print to PDF as handout.

## 3. Functional requirements

### 3.1 Workshop & DEFINE block

- FR-1.1 Workshop fields: `title`, `topicSentence` (one-line "what this is about"), `audience` (free multiline — counts, segments, roles), `date` (+ start time), `targetDurationMin`, `language` (`en` | `vn` | `mixed`), `description`.
- FR-1.2 Dashboard lists workshops as cards: title, date, planned vs target duration, item and slide counts. Create / duplicate / delete (delete = confirm + snapshot first).

### 3.2 Planner (run-sheet)

Modeled directly on the existing Sheets workflow (see §1.1).

- FR-2.1 A workshop's plan is an **ordered flat list of items**; items of type `section` act as group headers for the items below them (until the next section) — exactly like the sheet's numbered section rows.
- FR-2.2 Item fields: `title` (Topic–Question), `keyIdeas` (markdown, multiline — the content/facilitation notes column), `durationMin`, `typeId` (from the editable type taxonomy), `materials`, `sourceRefs[]`, `bankRef` (idea-bank provenance), `slides[]` (§3.5).
- FR-2.3 **Timing math**, always live: per-section subtotal, workshop total, delta vs `targetDurationMin` (over = red), computed clock time per item from workshop start time.
- FR-2.4 Reorder via drag handle (HTML5 drag & drop); moving a section moves its block. Reordering items **is** reordering the deck (§3.5).
- FR-2.5 **Item type taxonomy is user-editable data** (add/edit/remove/reorder), seeded with Dave's current dropdown: category `segment` (S:) or `activity` (A:) or `structural`, name, color. Seed list: `S: CTA/Hook`, `S: Lecture/Explanation`, `S: Story/Example`, `S: Analyze Students Input`, `S: Demo`, `S: Debrief`, `A: Individual Activity`, `A: Pair Activity`, `A: Group Activity`, `A: Whole-Room Activity`, `Break`, `Q&A`. Type colors badge the run-sheet rows (activities visually pop, as in the sheet).
- FR-2.6 Sources: per-workshop list of `{url, title, note}`; items reference sources by id; one-click open.

### 3.3 Idea bank

- FR-3.1 Per-user library of reusable activity ideas, **seeded** with the ~30 entries in Appendix A. Fields: `title`, `typeId`, `description` (markdown: how to run it), `typicalDurationMin`, `groupSize`, `materials`, `tags[]`, `sources[]`, `suggestedTemplates[]`.
- FR-3.2 Browse / text-search / filter by tag & type. CRUD + duplicate.
- FR-3.3 "Add to plan" inserts a plan item pre-filled from the bank entry (keeps `bankRef`); "Save to bank" promotes a good plan item into the bank.

### 3.4 Slide templates (registry)

- FR-4.1 A slide template = data: `{id, name, category, description, fields[], html, css, js?, builtin}` (schema details §4.4). Seeded with the ~18 built-ins in Appendix B on first load.
- FR-4.2 Template manager: list (builtin/custom badges), create / edit / duplicate / delete (builtins: duplicate-then-edit; deleting a builtin just hides it and can be restored from seed). Editing = field-schema builder + HTML/CSS/JS tabs (CodeMirror) + live preview with sample data.
- FR-4.3 A template edit re-renders every slide using it (slides store only field *values*).

### 3.5 Slides & the sync contract

The load-bearing rules:

- FR-5.1 **Every slide is attached to exactly one plan item.** The create-slide flow requires choosing an existing item or creating a new item in the same gesture. No orphan slides, ever.
- FR-5.2 One item → 0..N ordered slides. **Deck order = flatten(plan items in order → each item's slides in order).** Deck order is always derived, never stored separately.
- FR-5.3 Therefore: reordering/inserting/deleting plan items automatically reorders the deck. Deleting an item prompts: delete its slides or re-attach them to another item.
- FR-5.4 A slide = `{id, templateId, fields{}, speakerNotes, interactions[]}`. Editing = template picker + a **form generated from the template's field schema** (markdown editor for markdown fields, list editor for list fields). No code editing on slides — code lives in templates; the `custom-html` escape hatch (§4.4) is the one exception.
- FR-5.5 Slides can bind plan context (item title, duration, section, agenda) via computed fields (§4.4) — retiming an item updates its instruction slide's timer text automatically.

### 3.6 Present mode

- FR-6.1 `present.html#/<workshopId>?mode=present`: the slide fills the largest 16:9 rectangle that fits the window, **letterboxed on black** (bars top/bottom or sides as the window ratio dictates). **No controls, chrome, or instructions are visible by default — the audience sees only the slide.** Keyboard nav (→/space = next step or slide, ← = back, `Esc` = overview grid, `R` = toggle read mode, `N` = notes, `T` = timer).
- FR-6.1b All presenter chrome (timer, schedule bar, progress, notes drawer, join-code badge, key hints) renders as overlays on top of the letterbox: hidden by default. They are revealed **only** by (a) the relevant hotkey, or (b) moving the pointer into the top or bottom edge zone (~64 px band) — general mouse movement across the slide does **not** reveal them, so gesturing at the screen while presenting never flashes UI at the audience. Overlays auto-hide after ~3 s once the pointer leaves the edge zone. Pinning an element (e.g. keep the timer up) is a per-element toggle that persists for the session.
- FR-6.2 **Step reveals**: declarative `data-step="n"` in template HTML; the player reveals steps ≤ current step. Deterministic — jumping to any slide+step state works (backward nav, resume).
- FR-6.3 **Timers** (overlay chrome per FR-6.1b, not slide content): countdown per plan item from `durationMin`, start/pause/reset, overrun turns red; a schedule bar shows actual vs planned position in the workshop.
- FR-6.4 **Speaker notes** drawer (slide `speakerNotes` + the item's `keyIdeas`), visible only in present chrome — never printed or projected via a second-screen; v1 is a toggle drawer on the presenting machine.
- FR-6.5 Live session controls: start/end session, join code + QR badge, activate/deactivate the current slide's interaction (§3.8).

### 3.7 Read / print mode

- FR-7.1 Same player, `?mode=read`: all slides rendered linearly in plan order with plan-item/section headings between groups; **all steps expanded**; interactions render their question + (if a session ran) final results.
- FR-7.2 Print stylesheet: one slide per page (`break-inside: avoid`), backgrounds preserved hint, header/footer with workshop title + page numbers. Browser print → PDF; Chrome is the supported export path.
- FR-7.3 Mode is a URL param and a one-key toggle (`R`) — "automatically toggle between two modes" = the same content, two renderings, zero duplication.

### 3.8 Participant interaction

- FR-8.1 Interaction **kinds** are built into the participant page (it never runs user-authored JS): `choice` (single/multi, optional correct answer), `freetext` (short text, 1..N submissions), `rating` (numeric scale), `hotspot` (tap a point on an image).
- FR-8.2 **Interaction templates** = user-editable presets over kinds (Appendix C): question, options/config, results display style. Slides bind an interaction instance; interactive slide templates (poll-results, word-cloud, …) render live results.
- FR-8.3 Session flow: facilitator starts a session for a workshop → short join code (4 chars) + QR. Participants open `join.html?c=CODE` — no login; an anonymous participant id lives in their localStorage. Facilitator activates one interaction at a time; participant phones show the active input (or a waiting state); answers upsert (re-vote replaces, no duplicates).
- FR-8.4 Results appear on the projected slide within ≤ 2 s (HTTP polling, §4.7). Deactivating closes voting; results stay visible.
- FR-8.5 Facilitator can keep editing the workshop during a live session — sessions run on a **published snapshot** of the interaction definitions.
- FR-8.6 Responses persist after session end; CSV export per session (Phase 5).

### 3.9 AI assistance

- FR-9.1 **Generate slides for a plan item**: user picks slide count, a template per slide, and writes an instruction; server calls Claude with the workshop context + item content + the templates' field schemas; returns slide configs (`templateId` + `fields` + `speakerNotes`) — **structured content, not code** — validated against the schemas. UI shows generated slides for review; accept per-slide or regenerate with a refined instruction.
- FR-9.2 **Edit-via-prompt** on an existing slide: instruction + current fields in, revised fields out.
- FR-9.3 **Generate a template**: describe a new slide template ("a 'myth vs fact' two-panel with step reveal") → Claude returns `{name, fields, html, css, js?}` targeting the renderer contract (§4.4) → lands in the template manager as a draft for preview/edit before saving.
- FR-9.4 Guardrails: per-user daily generation cap (default 100), token log per call, current-month spend estimate visible in the UI, graceful 503 with a clear message when `ANTHROPIC_API_KEY` is unset. The rest of the app never depends on AI being available.

### 3.10 Accounts & data safety

- FR-10.1 Poker-pattern accounts: signup/login (username + password, bcrypt), JWT 30 days.
- FR-10.2 Authoring state autosaves (debounced ~800 ms) with rev-based optimistic concurrency; a stale write gets a 409 + authoritative state (second-device safety). Flush on tab hide. Snapshots retained (max 5) on session end / risky operations.
- FR-10.3 JSON export/import of a whole workshop (backup / sharing between accounts) — Phase 5.

## 4. Architecture

### 4.1 Repo integration

Follows `AGENTS.md` "Adding a tool" exactly:

| Piece | Path | Pattern source |
|---|---|---|
| Router | `tools/workshop.js` | copy auth/blob from `tools/poker.js` |
| DB | `data/workshop.sqlite` (auto via `req.toolDb`) | `db.js` `getDb('workshop')` |
| Frontend | `static/workshop/` (dir + `src/` ES modules) | `static/systems-explorer/` structure |
| Homepage card | `static/index.html` | existing cards |
| Sync/conflict client | `static/workshop/src/store.js` | vanilla port of `static/hdpg-poker.html` DataProvider (~lines 3186–3330) |

No build step. New npm dependency: `@anthropic-ai/sdk` only.

### 4.2 Data model — hybrid

**Authoring state**: one rev-guarded JSON blob per user in `user_data` (poker tables copied verbatim: `users`, `user_data(user_id, data, rev, updated_at)`, `user_snapshots`). Single author + whole-document operations (reorder must atomically move slide groups) + zero migration framework = blob wins. Slides are small field-value configs, so blob growth is mild; watch-item in §6.

```jsonc
{
  "workshops": [{
    "id": "w_x1", "title": "Effective Trainer Bootcamp",
    "topicSentence": "…", "audience": "16 total — 4 HAN, 12 SAI; 7 HR, 9 leads",
    "date": "2026-08-12", "startTime": "10:00",
    "targetDurationMin": 120, "language": "mixed", "description": "",
    "sources": [{ "id": "src_1", "url": "https://…", "title": "…", "note": "" }],
    "planItems": [                            // ordered array = canonical order
      { "id": "pi_1", "kind": "section", "title": "Introduction" },
      { "id": "pi_2", "kind": "item", "typeId": "t_hook",
        "title": "Hook — the Sergey Brin interview question",
        "keyIdeas": "It's about _teaching_ a concept, NOT purely a story",
        "durationMin": 3, "materials": "", "sourceRefs": [], "bankRef": null,
        "slides": [                           // ordered; deck = flatten(items → slides)
          { "id": "sl_1", "templateId": "tpl_title", // or a custom template id
            "fields": { "title": "…", "subtitle": "…" },
            "speakerNotes": "…", "interactions": [] }
        ] }
    ]
  }],
  "ideaBank":            [ /* Appendix A shape, seeded */ ],
  "planItemTypes":       [ /* FR-2.5 seed, editable */ ],
  "slideTemplates":      [ /* Appendix B shape, seeded */ ],
  "interactionTemplates":[ /* Appendix C shape, seeded */ ],
  "settings": { "seedVersion": 1 }
}
```

Seeding: built-in defaults ship as a frontend module (`src/seeds.js`); when the client loads a blob missing `slideTemplates`/`ideaBank`/`planItemTypes`/`interactionTemplates`, it merges the seeds in (tracked by `seedVersion`). The server stays schema-agnostic about the blob.

**Runtime tables** (things a per-user blob can't do: anonymous writers, server-enforced caps). Lazy init in `router.use`, poker-style:

```sql
CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,               -- 4-char join code, unambiguous alphabet
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workshop_id TEXT NOT NULL,
  interactions_json TEXT NOT NULL,         -- published snapshot of interaction defs (FR-8.5)
  active_interaction TEXT,                 -- interaction id or NULL
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  interaction_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,            -- client-generated UUID (localStorage)
  payload TEXT NOT NULL,                   -- JSON, shape depends on kind
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, interaction_id, participant_id)   -- upsert ⇒ idempotent re-votes
);
CREATE INDEX IF NOT EXISTS idx_responses_lookup ON responses(session_id, interaction_id);
CREATE TABLE IF NOT EXISTS ai_generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,                  -- 'generate-slides' | 'generate-template'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 4.3 API — `/api/workshop`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /signup`, `POST /login` | — | poker-clone (bcrypt 12, JWT 30 d, dummy-hash timing guard) |
| `GET /data`, `PUT /data` | ✅ | rev'd blob sync; `PUT` echoes `_rev`, mismatch → **409 + authoritative state**; `_snapshot` label triggers snapshot |
| `GET /snapshots`, `GET /snapshots/:id` | ✅ | poker-clone |
| `POST /generate-slides` | ✅ | `{workshopCtx, planItem, slides:[{templateId, instruction?}], instruction}` → `{slides:[{templateId, fields, speakerNotes}], usage}` |
| `POST /generate-template` | ✅ | `{description, exampleContent?}` → `{template, usage}` |
| `POST /sessions` | ✅ | `{workshopId, interactions:[…]}` → `{code}` (publishes snapshot) |
| `POST /sessions/:code/activate` | ✅ | `{interactionId \| null}` |
| `DELETE /sessions/:code` | ✅ | end session (sets `ended_at`) |
| `GET /sessions/:code` | public | `{active: interactionDef \| null, ended}` — participant poll target |
| `POST /sessions/:code/respond` | public | `{interactionId, participantId, payload}` — UNIQUE upsert |
| `GET /sessions/:code/results/:interactionId` | public | aggregated results (counts / word frequencies / points / stats) |

Public results are acceptable: they are projected on a screen anyway; codes are short-lived and unguessable enough at this scale.

### 4.4 Renderer contract (the heart of the system)

One player document renders every slide from `{templateId, fields}`. This contract is **also the verbatim spec fed to AI generation** — one source of truth, kept in `docs/workshop/renderer-contract.md` when implemented (Phase 2 writes it; Phase 3 imports it into the prompt).

**Template shape**

```jsonc
{
  "id": "tpl_bullets", "name": "Content bullets (reveal)",
  "category": "content",            // content | opener | activity | interactive | closing
  "description": "Title + progressive bullet list",
  "fields": [
    { "key": "title",   "label": "Title",   "type": "text",     "required": true },
    { "key": "bullets", "label": "Bullets", "type": "list", "item": "markdown", "min": 1 }
  ],
  "html": "<h2>{{title}}</h2><ul><li data-list=\"bullets\" data-step=\"auto\">{{item}}</li></ul>",
  "css": "h2 { color: var(--hdi-deep); } li { font-size: 1.4em; margin: .4em 0; }",
  "js": null,                        // optional hook module body, see below
  "builtin": true
}
```

**Field types**: `text`, `markdown`, `number`, `select` (enum), `image` (URL), `list` (of `text`/`markdown`/object with sub-keys), `interaction` (binds an interaction instance on the slide).

**Rendering pipeline** (`src/renderer.js`):
1. Substitute `{{key}}` placeholders. `text` fields are HTML-escaped; `markdown` fields render via `marked` (esm.sh, lazy) then insert.
2. `data-list="key"` on an element = repeat it per list entry; inside, `{{item}}` / `{{item.sub}}` refer to the entry.
3. **Computed context** available to every template: `{{_item.title}}`, `{{_item.durationMin}}`, `{{_item.keyIdeas}}`, `{{_section.title}}`, `{{_workshop.title}}`, `{{_workshop.date}}`, `{{_slideIndex}}`, `{{_slideCount}}`; the `agenda` template gets `_agenda` (sections with subtotals & clock times). This is what makes retiming the plan update instruction slides automatically (FR-5.5).
4. **Steps**: elements with `data-step="1..n"` are hidden in present mode until `currentStep ≥ n`; `data-step="auto"` on a `data-list` element numbers the repeated items 1..N. Read mode shows everything. Step count is derived from the rendered DOM — no JS needed for the standard reveal pattern.
5. **CSS scoping**: template CSS is prefixed so each selector applies under `[data-template="<id>"]` (simple selectors only; documented limitation).
6. **JS hooks** (optional, most templates need none): the `js` string is evaluated as a module body returning `{ onRender(ctx), onStep(ctx, step), onResults(ctx, data), onDestroy(ctx) }` with `ctx = { root, slide, fields, mode, item, workshop }`. Hooks run in the player DOM — acceptable for a single trusted author (see §6 Risks).
7. **`custom-html` escape hatch**: one builtin template whose single `rawHtml` field renders inside `<iframe sandbox="allow-scripts">` for fully custom simulation slides. The only sandbox boundary in the system; slides in the iframe get mode/step via postMessage. Phase 5.

**Interactive templates** (poll-results, word-cloud, …) declare an `interaction` field; the player pushes `onResults` every poll tick while that slide's interaction is active.

### 4.5 AI generation (server-side)

- `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY` via `fly secrets set`; model constant `claude-sonnet-5` (do **not** send `temperature`; `max_tokens` 16000; non-streaming — single-call latency is fine for a review-based UX).
- Prompt assembly: **stable prefix** (renderer contract + brand rules: HDI reds `#BD0129/#8E011F/#51000C` as CSS vars, Merriweather headings / Be Vietnam Pro body, bilingual-content note) with a `cache_control` breakpoint → cheap repeated calls; then the variable part (workshop DEFINE block, plan item, target templates' field schemas, user instruction).
- `generate-slides` returns JSON (tool-use/structured output); server validates every slide against its template's field schema (required fields present, types match, list mins) and rejects/retries once on failure.
- `generate-template` returns the template JSON; server validates shape only — the human previews before saving (FR-9.3).
- Cost model: slide-content calls ≈ 3–5 K in / 1–2 K out ≈ **$0.02–0.05**; template codegen ≈ $0.05–0.15. Daily cap (100) enforced from `ai_generations`; monthly spend SUM surfaced in UI.

### 4.6 Frontend structure

```
static/workshop/
  index.html        # authoring SPA (hash routes): login → dashboard → planner → slide editor → templates
  present.html      # player: #/<workshopId>?mode=present|read
  join.html         # participant page: ?c=CODE
  styles.css        # brand vars + app chrome
  src/
    api.js          # fetch wrapper, JWT storage, error normalization
    store.js        # DataProvider port: rev tracking, 800ms debounce, pagehide flush, 409-adopt
    seeds.js        # builtin templates, idea bank, item types, interaction presets (+ seedVersion)
    planner.js      # dashboard, DEFINE block, run-sheet, timing math, idea bank UI, sources
    editor.js       # slide list per item, attachment flow, field forms, AI dialogs
    templates.js    # template manager (schema builder, CodeMirror lazy via esm.sh, preview)
    renderer.js     # §4.4 pipeline (shared by editor preview, player, read mode)
    player.js       # navigation, steps, timers, notes, session controls, results polling
    participant.js  # join page: poll session state, render kind inputs, submit
```

Vanilla ES modules, no framework (systems-explorer precedent; poker's React/Babel stack is explicitly *not* the model). CodeMirror 6 and `marked` load lazily from esm.sh with plain-`<textarea>` / plain-text fallbacks.

### 4.7 Realtime = HTTP polling (deliberate — not a placeholder)

Participants and the player poll every **2 s** (`GET /sessions/:code`, `GET …/results/:id`). Why polling beats WebSockets/SSE *for this workload*:

- **Load is trivial**: ≤ 100 phones ≈ 50 req/s against synchronous µs-level better-sqlite3 reads (WAL) on the single Fly instance. Sockets save resources that aren't scarce here.
- **Phones are hostile to sockets**: participants lock screens, switch apps, and ride flaky venue/corporate Wi-Fi (captive portals and proxies that mishandle WS upgrades). A socket needs heartbeats + reconnect/backoff + missed-state resync — which in practice means re-implementing polling as the fallback anyway. Plain HTTP polling *is* the self-healing path, with zero extra code.
- **Latency doesn't matter at 2 s**: results render on the projector while votes trickle in over tens of seconds; the facilitator activating a question 0–2 s before phones show it is imperceptible in a room.
- **Zero new moving parts**: no `ws`/socket.io dependency, no upgrade handling in Express, no Fly idle-timeout tuning.

**Documented upgrade path** if sub-second updates are ever wanted: keep phones on polling (they benefit most from its robustness) and give the **player only** an SSE stream for results — one long-lived connection instead of one per phone, ~30 lines server-side, no client library. Revisit only if 2 s visibly lags a real workshop. Ceiling documented in §6.

## 5. Non-functional requirements

- **Security**: JWT_SECRET required in production (process exits without it — poker pattern); bcrypt cost 12; participant endpoints validate session code + payload shape/size (`payload` ≤ 2 KB, freetext length caps); rate-limit `respond` per participant id (in-memory, e.g. 10/min).
- **Performance**: planner interactions < 16 ms frame budget for lists ≤ 300 items; present-mode slide transitions instant (pre-rendered DOM, hidden/shown); poll round-trip ≤ 2 s.
- **Reliability**: no data loss on concurrent edits (409 + adopt-server, verified two-tab test); autosave flush on `pagehide` with `keepalive`; snapshots before destructive ops.
- **Print**: Chrome is the supported print/PDF path; Safari/Firefox best-effort.
- **Scale ceilings (documented, accepted)**: ~200 concurrent participants; blob comfortably to ~1–2 MB per user.
- **Cost**: AI daily cap 100 generations/user; monthly spend visible; app fully usable with zero AI budget.

## 6. Risks & open questions

| # | Risk | Position |
|---|---|---|
| R1 | **Template/hook JS runs in the player DOM** (user- or AI-authored). Could exfiltrate the author's own JWT if malicious/prompt-injected. | Accepted for a single trusted author. AI-generated templates are always human-previewed before save (FR-9.3). The `custom-html` path is sandboxed. Never expand to untrusted template sharing without moving rendering into sandboxed iframes. |
| R2 | Markdown/state XSS — `marked` output is injected into the DOM. | Own-content trust (single author). Escape all `text` fields; participant-submitted strings (word clouds, walls) are **always text-node inserted, never innerHTML** — this one is non-negotiable since participants are untrusted. |
| R3 | AI cost runaway | Daily cap + token log + spend display; Sonnet default; caps server-enforced. |
| R4 | SQLite under audience bursts (synchronous better-sqlite3 blocks the event loop) | Fine to ~200 participants; if ever exceeded: 1 s in-memory aggregation cache on results reads. |
| R5 | Blob growth (many workshops × slides) | Slides are small configs (~0.5 KB); watch-item. Escape hatch: move `slides` to a table — API already isolates them per plan item. |
| R6 | Print fidelity variance across browsers | Chrome-only support stated; validated in Phase 2 before the approach ossifies. |
| R7 | Participant PII | Responses are anonymous (random participant id, no names unless the facilitator asks in a freetext). Retention: kept until the facilitator deletes the session; CSV export (Phase 5). State this in workshop materials if needed. |
| Q1 | Second-screen presenter view (notes on laptop, clean output on projector)? | Out of v1; notes drawer suffices. Revisit after real use. |
| Q2 | Import existing Google Sheets plans (paste TSV)? | Phase 5 candidate — high migration value, small parser. |

---

## Appendix A — Idea bank seed (~30 activities)

Types: I = icebreaker/opener, E = energizer, B = brainstorm, D = discussion, G = game/simulation, AP = application, R = reflection/debrief, S = structural. Durations are typical defaults, editable per use.

| # | Activity | Type | Min | Group size | Materials | How it runs (seed description) | Suggested templates |
|---|---|---|---|---|---|---|---|
| 1 | Two Truths and a Lie | I | 10–15 | any | — | Each person states 3 "facts", group votes the lie. Fast trust-builder. | activity-instructions |
| 2 | Human Bingo | I | 15 | 10+ | printed cards | Grid of traits; find a different person per square; first bingo wins. | activity-instructions, image-caption |
| 3 | One-Word Check-in | I | 5–10 | any | — | Round-robin: one word on your current state / expectation. | word-cloud (live) |
| 4 | Expectations Wall | I | 10 | any | stickies or phones | Everyone posts what they want from the session; cluster live; revisit at close. | qa-wall |
| 5 | Speed Networking | I | 10–15 | 8+ | timer | Rotating 2-min pairs with a prompt per round. | activity-instructions, timer via chrome |
| 6 | Rock-Paper-Scissors Tournament | E | 5–10 | 8+ | — | Losers become cheerleaders of winners; bracket to a champion. | activity-instructions |
| 7 | 5-4-3-2-1 Stretch & Shake | E | 3–5 | any | — | Countdown shakes per limb; halves each round. | activity-instructions |
| 8 | Category Toss | E | 5 | 6–20 | soft ball | Toss + name an item in the category; hesitate = new category. | activity-instructions |
| 9 | Brainwriting 6-3-5 | B | 30 | 6/table | worksheets | 6 people write 3 ideas in 5 min, pass sheet, build on others; 108 ideas/table. | activity-instructions, debrief-questions |
| 10 | 1-2-4-All | B | 12–20 | any | — | Solo 1 min → pairs 2 min → fours 4 min → whole room shares. (Liberating Structures) | activity-instructions, content-bullets |
| 11 | Crazy 8s | B | 10 | any | paper, marker | Fold paper in 8; sketch 8 variants in 8 minutes; share best. | activity-instructions |
| 12 | Mind Mapping | B | 15–20 | 2–6/group | flipchart | Central concept, radiating branches; groups present maps. | activity-instructions, image-caption |
| 13 | Reverse Brainstorm | B | 15–20 | any | flipchart | "How would we guarantee failure?" then invert each answer. | activity-instructions, two-column |
| 14 | Think-Pair-Share | D | 10–15 | any | — | Solo reflection → pair discussion → volunteers share out. | discussion-prompt (content-bullets) |
| 15 | Fishbowl | D | 20–30 | 10+ | chairs in circles | Inner circle discusses, outer observes; open chair for joiners; swap. | activity-instructions |
| 16 | World Café | D | 45–60 | 12+ | tables, flipcharts | Rotating table conversations, host stays, harvest at the end. | activity-instructions, agenda |
| 17 | Gallery Walk | D | 20–30 | any | posters on walls | Small groups rotate past stations, annotate with stickies, debrief. | activity-instructions |
| 18 | Spectrum Line / Polarity Walk | D | 15–20 | any | floor space | Statement read; stand along the agree↔disagree line; interview positions. | quote, rating-scale (live) |
| 19 | NASA Moon Survival | G | 45–60 | teams of 4–6 | ranking sheets (in repo: `projects/nasa-moon-survival`) | Rank 15 items solo → team consensus → NASA answer; scores show team > individual. | activity-instructions, comparison-table, big-number |
| 20 | Marshmallow Challenge | G | 45 | teams of 4 | spaghetti, tape, marshmallow | 18 min to build the tallest marshmallow-topped tower; iterate-early lesson. | activity-instructions, big-number |
| 21 | Paper Tower | G | 30 | teams | paper only | Tallest freestanding tower; constraints breed creativity. | activity-instructions |
| 22 | Broken Squares | G | 30–40 | 5/group | puzzle sets | Silent cooperation puzzle: give pieces, can't take; collaboration debrief. | activity-instructions, debrief-questions |
| 23 | Case Study Analysis | AP | 30–45 | 3–6/group | case handout | Read → analyze with a provided framework → present recommendations. | two-column, content-bullets |
| 24 | Role Play | AP | 20–40 | pairs/triads | scenario cards | Actor/counterpart/observer rotate; observer uses feedback form. | activity-instructions, debrief-questions |
| 25 | ORID Focused Debrief | R | 15–20 | any | — | 4 question rounds: Objective→Reflective→Interpretive→Decisional. | debrief-questions |
| 26 | Plus/Delta | R | 10 | any | flipchart or poll | Two columns: what worked / what to change. | two-column, qa-wall |
| 27 | Journaling Prompt | R | 10 | solo | notebooks | Silent written reflection on 1–3 prompts; optional pair share. | quote, content-bullets |
| 28 | Action Planning | R | 15–20 | solo→pairs | worksheet | Commit to 1–3 specific actions with dates; accountability partner exchange. | activity-instructions, content-bullets |
| 29 | Quiz Round | AP | 10–15 | any | phones | 5–10 MC questions on the material, live scoring. | quiz-mc (live) |
| 30 | Poll & Discuss | D | 5–10 | any | phones | Live poll on a spicy question → discuss the distribution. | poll-results (live) |
| 31 | One-Word Closing Circle | R | 5–10 | any | — | Round-robin single word takeaway; word cloud version for large rooms. | word-cloud (live), closing |
| 32 | Q&A Block | S | 10–15 | any | phones optional | Open floor or moderated wall of submitted questions. | qa-wall |
| 33 | Break | S | 10–15 | — | — | Timed break; slide shows return time. | section-divider (with `_item.durationMin`) |
| 34 | Lecture Segment | S | 5–15 | — | — | Structured content delivery; keep ≤ 15 min between activations. | content-bullets, two-column, big-number |

## Appendix B — Built-in slide templates (18)

All templates use brand CSS vars (`--hdi-bright: #BD0129`, `--hdi-deep: #8E011F`, `--hdi-dark: #51000C`), Merriweather for display headings, Be Vietnam Pro for body. Computed context fields (§4.4.3) available everywhere.

| # | id | Name / purpose | Fields (key: type) | Steps | Interaction |
|---|---|---|---|---|---|
| 1 | `tpl_title` | Workshop title slide | title: text, subtitle: text, presenter: text, date: text (defaults from `_workshop`) | — | — |
| 2 | `tpl_section` | Section divider (giant number + name) | number: text, title: text, subtitle: text | — | — |
| 3 | `tpl_agenda` | Agenda — auto-fed from the plan | intro: markdown (list body from `_agenda`) | — | — |
| 4 | `tpl_bullets` | Content bullets with reveal | title: text, bullets: list(markdown) | auto per bullet | — |
| 5 | `tpl_two_col` | Two-column compare/contrast | title: text, leftTitle: text, leftBody: markdown, rightTitle: text, rightBody: markdown | 2 (left, right) | — |
| 6 | `tpl_image` | Full image + caption | title: text, imageUrl: image, caption: markdown | — | — |
| 7 | `tpl_quote` | Big quote | quote: markdown, attribution: text | — | — |
| 8 | `tpl_big_number` | One big stat | number: text, label: text, context: markdown | 2 (number, context) | — |
| 9 | `tpl_instructions` | Activity instructions | activityTitle: text, steps: list(markdown), groupSize: text, materials: text (+ shows `{{_item.durationMin}}` min badge) | auto per step | — |
| 10 | `tpl_debrief` | Debrief questions, one at a time | title: text, questions: list(markdown) | auto per question | — |
| 11 | `tpl_table` | Comparison table | title: text, headers: list(text), rows: list(list-of-text) | — | — |
| 12 | `tpl_quiz` | Multiple-choice quiz | question: markdown, poll: interaction(kind=choice, correct) | reveal answer | choice |
| 13 | `tpl_poll` | Poll + live bar results | question: markdown, poll: interaction(kind=choice) | — | choice |
| 14 | `tpl_wordcloud` | Word cloud, live | question: markdown, cloud: interaction(kind=freetext, aggregate=words) | — | freetext |
| 15 | `tpl_rating` | Scale rating, live avg + distribution | question: markdown, rating: interaction(kind=rating) | — | rating |
| 16 | `tpl_hotspot` | Tap-the-image heatmap | question: markdown, imageUrl: image, spot: interaction(kind=hotspot) | — | hotspot |
| 17 | `tpl_qa_wall` | Open wall of submitted cards | title: text, wall: interaction(kind=freetext, aggregate=cards) | — | freetext |
| 18 | `tpl_closing` | Thank-you / contacts / actions | title: text, message: markdown, contact: text | — | — |
| (19) | `tpl_custom_html` | Escape hatch (sandboxed iframe) — Phase 5 | rawHtml: text(raw) | via postMessage | — |

## Appendix C — Interaction kinds & seed presets

**Kinds** (hard-coded participant input UIs in `join.html` — participants never run user-authored code):

| Kind | Participant sees | Payload | Aggregation options |
|---|---|---|---|
| `choice` | question + option buttons (single or multi) | `{selected: [i]}` | counts per option; optional `correctIndex` for quiz reveal |
| `freetext` | question + text input (maxLen, 1..N submissions) | `{texts: ["…"]}` | `words` (frequency, stop-word trimmed) or `cards` (raw list) |
| `rating` | question + numeric scale buttons (min..max, labels) | `{value: n}` | average + distribution |
| `hotspot` | question + tappable image | `{x, y}` (0–1 normalized) | scatter/heat overlay |

**Seed presets** (`interactionTemplates`, editable):

| # | Preset | Kind | Config |
|---|---|---|---|
| 1 | Single-choice poll | choice | single, 2–6 options, bar-chart results |
| 2 | Multi-choice poll | choice | multi, bar-chart results |
| 3 | Quiz question | choice | single + `correctIndex`, results hidden until reveal step |
| 4 | Word cloud | freetext | maxLen 30, up to 3 submissions, `words` aggregation |
| 5 | Open wall | freetext | maxLen 200, 1 submission, `cards` aggregation |
| 6 | 1–5 scale | rating | min 1 max 5, endpoint labels |
| 7 | Image hotspot | hotspot | image URL, dot overlay |
