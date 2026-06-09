require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// --- Auth helper ---
function requireAdmin(req, res) {
  if (req.query.password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// --- Email ---
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
    subject: 'Laptop Reservation Confirmed',
    text: `Hi ${name},\n\nYour ${color} laptop reservation is confirmed.\nReservation ID: LP-${id}\n\nThank you.`,
  });
}

// --- Faculty helpers ---
function isApprovedFaculty(email) {
  const row = db.prepare('SELECT id FROM faculty_emails WHERE email = ?').get(email.trim().toLowerCase());
  return !!row;
}

// ==================== ROUTES ====================

// GET /api/inventory
app.get('/api/inventory', (req, res) => {
  const rows = db.prepare('SELECT color, quantity FROM inventory').all();
  const inv = {};
  rows.forEach(r => (inv[r.color.toLowerCase()] = r.quantity));
  res.json(inv);
});

// POST /api/check-email
app.post('/api/check-email', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (!isApprovedFaculty(email)) {
    return res.status(403).json({ error: 'This email is not on the approved faculty list.' });
  }
  const existing = db.prepare('SELECT id FROM reservations WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'A reservation has already been made with this email.' });
  }
  res.json({ ok: true });
});

// POST /api/reservations
app.post('/api/reservations', (req, res) => {
  const { name, email, color } = req.body;
  if (!name || !email || !color) {
    return res.status(400).json({ error: 'Name, email, and color are required.' });
  }
  if (!['Blue', 'Yellow'].includes(color)) {
    return res.status(400).json({ error: 'Color must be Blue or Yellow.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (!isApprovedFaculty(email)) {
    return res.status(403).json({ error: 'This email is not on the approved faculty list.' });
  }

  const reserve = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM reservations WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) throw Object.assign(new Error('Email already has a reservation.'), { status: 409 });
    const inv = db.prepare('SELECT quantity FROM inventory WHERE color = ?').get(color);
    if (!inv || inv.quantity <= 0) throw Object.assign(new Error(`No ${color} laptops available.`), { status: 409 });
    db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE color = ?').run(color);
    const result = db.prepare('INSERT INTO reservations (name, email, color) VALUES (?, ?, ?)').run(name.trim(), email.trim().toLowerCase(), color);
    return result.lastInsertRowid;
  });

  let id;
  try { id = reserve(); }
  catch (err) { return res.status(err.status || 500).json({ error: err.message }); }

  const rows = db.prepare('SELECT color, quantity FROM inventory').all();
  const inv = {};
  rows.forEach(r => (inv[r.color.toLowerCase()] = r.quantity));
  io.emit('inventory_update', inv);

  sendConfirmation(name, email, color, id).catch(() => {});
  res.status(201).json({ id: `LP-${id}`, color, message: 'Reservation confirmed!' });
});

// ==================== ADMIN ROUTES ====================

// GET /api/admin/reservations
app.get('/api/admin/reservations', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare('SELECT * FROM reservations ORDER BY reserved_at DESC').all();
  res.json(rows);
});

// GET /api/admin/reservations/csv
app.get('/api/admin/reservations/csv', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare('SELECT name, email, color, reserved_at FROM reservations ORDER BY reserved_at DESC').all();
  const lines = ['Name,Email,Color,Reserved At', ...rows.map(r => `${r.name},${r.email},${r.color},${r.reserved_at}`)];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="reservations.csv"');
  res.send(lines.join('\n'));
});

// DELETE /api/admin/reservations/:id
app.delete('/api/admin/reservations/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const cancel = db.transaction(() => {
    const row = db.prepare('SELECT color FROM reservations WHERE id = ?').get(req.params.id);
    if (!row) throw Object.assign(new Error('Reservation not found.'), { status: 404 });
    db.prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id);
    db.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE color = ?').run(row.color);
  });
  try { cancel(); }
  catch (err) { return res.status(err.status || 500).json({ error: err.message }); }

  const rows = db.prepare('SELECT color, quantity FROM inventory').all();
  const inv = {};
  rows.forEach(r => (inv[r.color.toLowerCase()] = r.quantity));
  io.emit('inventory_update', inv);
  res.json({ message: 'Reservation cancelled.' });
});

// GET /api/admin/faculty  — list all approved emails
app.get('/api/admin/faculty', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare('SELECT id, email, added_at FROM faculty_emails ORDER BY added_at DESC').all();
  res.json(rows);
});

// POST /api/admin/faculty  — add one or many emails (newline or comma separated)
app.post('/api/admin/faculty', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const raw = (req.body.emails || '');
  const emails = raw
    .split(/[\n,]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  if (emails.length === 0) {
    return res.status(400).json({ error: 'No valid email addresses found.' });
  }

  const insert = db.prepare('INSERT OR IGNORE INTO faculty_emails (email) VALUES (?)');
  const insertMany = db.transaction(list => list.forEach(e => insert.run(e)));
  insertMany(emails);

  res.json({ added: emails.length });
});

// DELETE /api/admin/faculty/:id
app.delete('/api/admin/faculty/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare('DELETE FROM faculty_emails WHERE id = ?').run(req.params.id);
  res.json({ message: 'Removed.' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
