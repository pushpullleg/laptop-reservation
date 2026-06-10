const { createClient } = require('@libsql/client');
const Database = require('better-sqlite3');
const path = require('path');

let db;

if (process.env.TURSO_DATABASE_URL) {
  // Production: Turso cloud SQLite
  db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  db._isTurso = true;
} else {
  // Local dev: file-based SQLite (synchronous)
  db = new Database(path.join(__dirname, 'reservations.db'));
  db._isTurso = false;
}

const SCHEMA = `
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
`;

async function initDb() {
  if (db._isTurso) {
    // Run each statement individually (Turso batch requires array of statements)
    const stmts = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
    for (const sql of stmts) {
      await db.execute(sql);
    }
    // Seed inventory if empty
    const res = await db.execute('SELECT COUNT(*) as c FROM inventory');
    if (Number(res.rows[0].c) === 0) {
      await db.batch([
        { sql: "INSERT INTO inventory (color, quantity) VALUES ('Blue', 26)" },
        { sql: "INSERT INTO inventory (color, quantity) VALUES ('Yellow', 26)" },
      ], 'write');
    }
  } else {
    db.exec(SCHEMA);
    const count = db.prepare('SELECT COUNT(*) as c FROM inventory').get().c;
    if (count === 0) {
      db.prepare("INSERT INTO inventory (color, quantity) VALUES (?, ?)").run('Blue', 26);
      db.prepare("INSERT INTO inventory (color, quantity) VALUES (?, ?)").run('Yellow', 26);
    }
  }
}

module.exports = { db, initDb };
