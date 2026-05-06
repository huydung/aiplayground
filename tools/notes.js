const express = require('express');
const router = express.Router();

// Initialize schema on first use
function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

router.use((req, res, next) => {
  init(req.toolDb);
  next();
});

router.get('/notes', (req, res) => {
  const rows = req.toolDb.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
  res.json(rows);
});

router.get('/notes/:id', (req, res) => {
  const row = req.toolDb.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/notes', (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = req.toolDb.prepare('INSERT INTO notes (title, body) VALUES (?, ?)').run(title, body || '');
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/notes/:id', (req, res) => {
  const { title, body } = req.body;
  const result = req.toolDb.prepare(
    'UPDATE notes SET title = COALESCE(?, title), body = COALESCE(?, body), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(title ?? null, body ?? null, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.delete('/notes/:id', (req, res) => {
  const result = req.toolDb.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
