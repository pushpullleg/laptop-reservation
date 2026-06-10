const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.NODE_ENV === 'production'
  ? '/data/reservations.db'
  : path.join(__dirname, 'reservations.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY,
    color TEXT UNIQUE NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity >= 0)
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS faculty_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed inventory if empty
const count = db.prepare('SELECT COUNT(*) as c FROM inventory').get().c;
if (count === 0) {
  db.prepare('INSERT INTO inventory (color, quantity) VALUES (?, ?)').run('Blue', 26);
  db.prepare('INSERT INTO inventory (color, quantity) VALUES (?, ?)').run('Yellow', 26);
}

module.exports = db;
