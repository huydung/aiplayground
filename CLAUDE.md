# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow

**Always push to the `beta` branch first** before pushing to any other branch or main.

The active development branch is `claude/document-app-features-T364z`.

## Commands

```bash
npm run dev      # start with --watch (auto-restarts on file changes)
npm start        # production start
```

No linter, test suite, or build step is configured.

## Architecture

Single-file Express server (`server.js`) that auto-loads tool routers from `tools/*.js` and serves static files from `static/`.

**Database layer (`db.js`):**  
Each tool gets its own SQLite file under `./data/<name>.sqlite` (or `DATA_DIR` env). `getDb(name)` returns a cached `better-sqlite3` connection with WAL mode and foreign keys enabled. The main app DB (`data/database.sqlite`) stores the tool registry.

**Adding a tool:**
1. Create `tools/<name>.js` — an Express router. Access the tool's DB via `req.toolDb` (injected by `server.js` middleware). Call `req.toolDb.exec(...)` inside a `router.use(...)` to init the schema on first request.
2. Add a card to `static/index.html` pointing to the tool's frontend.
3. Put the frontend in `static/<name>/index.html` or as a standalone `static/<name>.html`.

**Auth pattern (see `tools/poker.js`):**  
JWT-based auth with bcrypt password hashing. `JWT_SECRET` must be set via env var in production. Tokens expire in 30 days. User state is stored as a JSON blob in a `user_data` table keyed by `user_id`.

**Deployment:**  
Fly.io (`fly.toml`), app name `hdi`, region `sin`. The `/data` volume persists all SQLite databases. `better-sqlite3` requires native compilation — the Dockerfile handles this with a multi-stage build using `python3 make g++`.
