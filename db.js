const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || './data';
const connections = new Map();

function getDb(name) {
  if (!connections.has(name)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const dbPath = path.join(DATA_DIR, `${name}.sqlite`);
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    connections.set(name, db);
  }
  return connections.get(name);
}

// Main application database
const mainDb = getDb('database');

module.exports = { getDb, mainDb, DATA_DIR };
