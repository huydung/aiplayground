const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET env var must be set in production');
    process.exit(1);
  }
  console.warn('WARNING: using default JWT_SECRET — set JWT_SECRET in production');
  return 'poker-dev-secret-do-not-use-in-prod';
})();

const SALT_ROUNDS = 12;

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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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

// POST /api/poker/signup
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

// POST /api/poker/login
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

// GET /api/poker/data — load user's saved state
router.get('/data', requireAuth, (req, res) => {
  const row = req.toolDb.prepare('SELECT data FROM user_data WHERE user_id = ?').get(req.user.id);
  res.json(row ? JSON.parse(row.data) : {});
});

// PUT /api/poker/data — persist user's full state blob
router.put('/data', requireAuth, (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid body' });
  const data = JSON.stringify(req.body);
  req.toolDb.prepare(`
    INSERT INTO user_data (user_id, data) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
  `).run(req.user.id, data);
  res.json({ ok: true });
});

module.exports = router;
