require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const { db, initDb } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ── DB abstraction (Turso is async, local SQLite is sync) ──────────────────
async function query(sql, args = []) {
  if (db._isTurso) {
    const res = await db.execute({ sql, args });
    return res.rows;
  }
  return db.prepare(sql).all(...args);
}

async function queryOne(sql, args = []) {
  if (db._isTurso) {
    const res = await db.execute({ sql, args });
    return res.rows[0] ?? null;
  }
  return db.prepare(sql).get(...args) ?? null;
}

async function run(sql, args = []) {
  if (db._isTurso) {
    const res = await db.execute({ sql, args });
    return { lastInsertRowid: Number(res.lastInsertRowid) };
  }
  return db.prepare(sql).run(...args);
}

async function getInventoryMap() {
  const rows = await query('SELECT color, quantity FROM inventory');
  const inv = {};
  rows.forEach(r => (inv[r.color.toLowerCase()] = Number(r.quantity)));
  return inv;
}

// ── Auth ───────────────────────────────────────────────────────────────────
function requireAdmin(req, res) {
  if (req.query.password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── Email ──────────────────────────────────────────────────────────────────
const mailer = process.env.SMTP_USER
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendConfirmation(name, email, color, id) {
  if (!mailer) return;
  await mailer.sendMail({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'MacBook Neo Claim Confirmed',
    text: `Hi ${name},\n\nYour ${color} MacBook Neo claim is confirmed.\nClaim ID: LP-${id}\n\nThank you.`,
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/inventory', async (req, res) => {
  try {
    res.json(await getInventoryMap());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/check-email', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Invalid email address.' });

    const faculty = await queryOne('SELECT id FROM faculty_emails WHERE email = ?', [email]);
    if (!faculty)
      return res.status(403).json({ error: 'This email is not on the approved staff list.' });

    const existing = await queryOne('SELECT id FROM reservations WHERE email = ?', [email]);
    if (existing)
      return res.status(409).json({ error: 'A claim has already been made with this email.' });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const { name, email, color } = req.body;
    if (!name || !email || !color)
      return res.status(400).json({ error: 'Name, email, and color are required.' });
    if (!['Blue', 'Yellow'].includes(color))
      return res.status(400).json({ error: 'Color must be Blue or Yellow.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Invalid email address.' });

    const cleanEmail = email.trim().toLowerCase();

    const faculty = await queryOne('SELECT id FROM faculty_emails WHERE email = ?', [cleanEmail]);
    if (!faculty)
      return res.status(403).json({ error: 'This email is not on the approved staff list.' });

    // Atomic: check stock + insert together
    if (db._isTurso) {
      const inv = await queryOne('SELECT quantity FROM inventory WHERE color = ?', [color]);
      if (!inv || Number(inv.quantity) <= 0)
        return res.status(409).json({ error: `No ${color} MacBooks available.` });

      const existing = await queryOne('SELECT id FROM reservations WHERE email = ?', [cleanEmail]);
      if (existing)
        return res.status(409).json({ error: 'A claim has already been made with this email.' });

      await db.batch([
        { sql: 'UPDATE inventory SET quantity = quantity - 1 WHERE color = ?', args: [color] },
        { sql: 'INSERT INTO reservations (name, email, color) VALUES (?, ?, ?)', args: [name.trim(), cleanEmail, color] },
      ], 'write');

      const row = await queryOne('SELECT id FROM reservations WHERE email = ?', [cleanEmail]);
      const id = row.id;
      io.emit('inventory_update', await getInventoryMap());
      sendConfirmation(name, email, color, id).catch(() => {});
      return res.status(201).json({ id: `LP-${id}`, color, message: 'Claim confirmed!' });
    } else {
      // Local SQLite — synchronous transaction
      const reserve = db.transaction(() => {
        const existing = db.prepare('SELECT id FROM reservations WHERE email = ?').get(cleanEmail);
        if (existing) throw Object.assign(new Error('A claim has already been made with this email.'), { status: 409 });
        const inv = db.prepare('SELECT quantity FROM inventory WHERE color = ?').get(color);
        if (!inv || inv.quantity <= 0) throw Object.assign(new Error(`No ${color} MacBooks available.`), { status: 409 });
        db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE color = ?').run(color);
        return db.prepare('INSERT INTO reservations (name, email, color) VALUES (?, ?, ?)').run(name.trim(), cleanEmail, color).lastInsertRowid;
      });
      const id = reserve();
      io.emit('inventory_update', await getInventoryMap());
      sendConfirmation(name, email, color, id).catch(() => {});
      return res.status(201).json({ id: `LP-${id}`, color, message: 'Claim confirmed!' });
    }
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════

app.get('/api/admin/reservations', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json(await query('SELECT * FROM reservations ORDER BY reserved_at DESC'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reservations/csv', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await query('SELECT name, email, color, reserved_at FROM reservations ORDER BY reserved_at DESC');
    const lines = ['Name,Email,Color,Reserved At', ...rows.map(r => `${r.name},${r.email},${r.color},${r.reserved_at}`)];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="claims.csv"');
    res.send(lines.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/reservations/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const row = await queryOne('SELECT color FROM reservations WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Claim not found.' });
    await run('DELETE FROM reservations WHERE id = ?', [req.params.id]);
    await run('UPDATE inventory SET quantity = quantity + 1 WHERE color = ?', [row.color]);
    io.emit('inventory_update', await getInventoryMap());
    res.json({ message: 'Claim cancelled.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/faculty', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json(await query('SELECT id, email, added_at FROM faculty_emails ORDER BY added_at DESC'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/faculty', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const emails = (req.body.emails || '')
      .split(/[\n,]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (emails.length === 0)
      return res.status(400).json({ error: 'No valid email addresses found.' });

    for (const e of emails) {
      await run('INSERT OR IGNORE INTO faculty_emails (email) VALUES (?)', [e]);
    }
    res.json({ added: emails.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/faculty/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await run('DELETE FROM faculty_emails WHERE id = ?', [req.params.id]);
    res.json({ message: 'Removed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDb()
  .then(() => server.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
