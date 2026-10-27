# Mai này em lớn — session app

Single-file HTML presentation app for a 2nd-grade class (Vietnamese). Read `DESIGN_BRIEF.md` before changing content or visuals.

## Layout
- `src/app.html` — the only source file (markup + CSS + JS). Contains the placeholder `__LOGO__`.
- `assets/logo.b64` — HDI logo (156×96 PNG, base64) inlined at build; `assets/hdi-logo.png` is the original.
- `scripts/build.py` — builds `dist/ba-vong-tron.html`, runs `node --check`, asserts emoji uniqueness.
- `scripts/shot.js` — Playwright screenshots + step map + page-error check.
- `docs/screenshots/` — reference renders (sNN = step index).

## Commands
```
python3 scripts/build.py                  # build + checks (needs node)
python3 scripts/build.py --shots 0 33 67  # + screenshots of those steps (needs `npm i playwright` + chromium)
open dist/ba-vong-tron.html               # run it
```

## Where things live in src/app.html
- `T0` / `H0` / `J0` — topic, help, job dictionaries (`key: 'emoji Name'`). Emoji must stay unique.
- `layout(st, hide)` — circle geometry; `setGoal/tick/draw` — tween + star badge.
- `build()` — the whole session script. Helpers: `add(step, notes)`, `frags(id, html, n, opt, notes)` (card with n click-reveals), `M(state, caption, {who, ask, star, hide})`, `C(id, html, {cls})`, `S(like, good, help, use)`.
- `render()` — draws a step: `card` | `model` | `kidHint` | `kidReveal` | `kidPhoto`.
- Settings / IndexedDB images / scoreboard at the bottom.

## Rules
- All kid-facing text in Vietnamese; owner edits copy heavily — keep strings easy to find in `build()`.
- Stage is fixed 1920×1080 and scaled; design in stage pixels, never viewport units.
- No external requests except Google Fonts (privacy promise to parents). No analytics, no uploads.
- If republishing as a claude.ai Artifact: file is published without `<!doctype>` (host wraps it); scripts only from cdnjs/jsdelivr/unpkg, fonts only from Google Fonts.
- Write "Huy Dũng" with diacritics.
