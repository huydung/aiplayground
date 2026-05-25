const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb, mainDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PROJECTS_DIR = path.join(__dirname, 'projects');
const PROJECTS_CONFIG = path.join(__dirname, 'projects.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));
app.use('/projects', express.static(PROJECTS_DIR));

// Bootstrap main DB
mainDb.exec(`
  CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Attach each tool's DB to req and load its router
app.use('/api/:tool', (req, res, next) => {
  const tool = req.params.tool;
  if (!/^[a-z0-9_-]+$/.test(tool)) {
    return res.status(400).json({ error: 'Invalid tool name' });
  }
  req.toolName = tool;
  req.toolDb = getDb(tool);
  next();
});

// Auto-load routers from tools/
const toolsDir = path.join(__dirname, 'tools');
if (fs.existsSync(toolsDir)) {
  fs.readdirSync(toolsDir)
    .filter(f => f.endsWith('.js'))
    .forEach(file => {
      const toolName = file.replace('.js', '');
      const router = require(path.join(toolsDir, file));
      app.use(`/api/${toolName}`, router);
    });
}

// List static projects
app.get('/api/projects', (req, res) => {
  let config = {};
  if (fs.existsSync(PROJECTS_CONFIG)) {
    try { config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8')); } catch (_) {}
  }

  const projects = [];
  if (fs.existsSync(PROJECTS_DIR)) {
    for (const entry of fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      const indexPath = path.join(PROJECTS_DIR, name, 'index.html');
      if (!fs.existsSync(indexPath)) continue;

      const cfg = config[name] || {};
      if (cfg.hidden) continue;

      projects.push({
        name,
        label: cfg.label || name,
        description: cfg.description || null,
        url: `/projects/${name}/`,
      });
    }
  }

  res.json(projects);
});

// List registered tools
app.get('/api/tools', (req, res) => {
  const rows = mainDb.prepare('SELECT * FROM tools ORDER BY name').all();
  res.json(rows);
});

// Register a tool
app.post('/api/tools', (req, res) => {
  const { name, label, description } = req.body;
  if (!name || !label) return res.status(400).json({ error: 'name and label required' });
  if (!/^[a-z0-9_-]+$/.test(name)) return res.status(400).json({ error: 'name must be lowercase alphanumeric with dashes/underscores' });
  try {
    mainDb.prepare('INSERT OR REPLACE INTO tools (name, label, description) VALUES (?, ?, ?)').run(name, label, description || null);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
