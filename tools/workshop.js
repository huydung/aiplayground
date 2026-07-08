const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// ponytail: cloned from tools/poker.js — same battle-tested auth + rev'd blob sync.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET env var must be set in production');
    process.exit(1);
  }
  console.warn('WARNING: using default JWT_SECRET — set JWT_SECRET in production');
  return 'workshop-dev-secret-do-not-use-in-prod';
})();

const SALT_ROUNDS = 12;
const MAX_SNAPSHOTS = 5;

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_data (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL DEFAULT '{}',
      rev INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      rev INTEGER NOT NULL,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_snapshots_user ON user_snapshots(user_id, id DESC);
  `);
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

router.use((req, res, next) => {
  initSchema(req.toolDb);
  next();
});

// POST /api/workshop/signup
router.post('/signup', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_-]{3,30}$/.test(username))
    return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, _ or -' });
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = req.toolDb
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username.trim(), hash);
    const token = jwt.sign({ id: result.lastInsertRowid, username: username.trim() }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, username: username.trim() });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
    console.error('signup error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/workshop/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const user = req.toolDb.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // Always run bcrypt to prevent timing-based username enumeration
  const hash = user?.password_hash ?? '$2a$12$invalidhashusedtowastetimex';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

// GET /api/workshop/data — load state blob; server rev embedded as _rev (client echoes it back on write)
router.get('/data', requireAuth, (req, res) => {
  const row = req.toolDb.prepare('SELECT data, rev FROM user_data WHERE user_id = ?').get(req.user.id);
  const data = row ? JSON.parse(row.data) : {};
  res.json({ ...data, _rev: row ? row.rev : 0 });
});

// PUT /api/workshop/data — persist full blob with optimistic concurrency. Stale _rev → 409 + authoritative state.
router.put('/data', requireAuth, (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    return res.status(400).json({ error: 'Invalid body' });

  const { _rev: incomingRev, ...payload } = req.body;
  const row = req.toolDb.prepare('SELECT data, rev FROM user_data WHERE user_id = ?').get(req.user.id);
  const storedRev = row ? row.rev : 0;

  if (incomingRev !== storedRev) {
    const stored = row ? JSON.parse(row.data) : {};
    return res.status(409).json({ error: 'stale_rev', ...stored, _rev: storedRev });
  }

  const snapshotLabel = payload._snapshot ? String(payload._snapshot).slice(0, 200) : null;
  delete payload._snapshot;

  const newRev = storedRev + 1;
  const dataStr = JSON.stringify(payload);
  const save = req.toolDb.transaction(() => {
    req.toolDb.prepare(`
      INSERT INTO user_data (user_id, data, rev) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, rev = excluded.rev, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, dataStr, newRev);

    if (snapshotLabel !== null) {
      req.toolDb.prepare('INSERT INTO user_snapshots (user_id, data, rev, label) VALUES (?, ?, ?, ?)')
        .run(req.user.id, dataStr, newRev, snapshotLabel);
      req.toolDb.prepare(`
        DELETE FROM user_snapshots WHERE user_id = ? AND id NOT IN (
          SELECT id FROM user_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT ?
        )`).run(req.user.id, req.user.id, MAX_SNAPSHOTS);
    }
  });
  save();
  res.json({ ok: true, _rev: newRev });
});

// GET /api/workshop/snapshots — list restorable snapshots (most recent first)
router.get('/snapshots', requireAuth, (req, res) => {
  const rows = req.toolDb.prepare(
    'SELECT id, rev, label, created_at FROM user_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ).all(req.user.id, MAX_SNAPSHOTS);
  res.json(rows);
});

// GET /api/workshop/snapshots/:id — fetch one snapshot's full data (for restore)
router.get('/snapshots/:id', requireAuth, (req, res) => {
  const row = req.toolDb.prepare(
    'SELECT data, rev, label, created_at FROM user_snapshots WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...JSON.parse(row.data), _snapshotRev: row.rev, _label: row.label, _createdAt: row.created_at });
});

module.exports = router;
