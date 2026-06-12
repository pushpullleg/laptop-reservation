import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function AdminPortal() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('reservations');

  const [reservations, setReservations] = useState([]);
  const [inventory, setInventory] = useState({ blue: null, yellow: null });

  const [faculty, setFaculty] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [facultyMsg, setFacultyMsg] = useState('');
  const [facultyLoading, setFacultyLoading] = useState(false);

  const loadReservations = useCallback(async (pw) => {
    const [rRes, iRes] = await Promise.all([
      fetch(`${API}/api/admin/reservations?password=${pw}`),
      fetch(`${API}/api/inventory`),
    ]);
    if (rRes.status === 401) return false;
    setReservations(await rRes.json());
    setInventory(await iRes.json());
    return true;
  }, []);

  const loadFaculty = useCallback(async (pw) => {
    const res = await fetch(`${API}/api/admin/faculty?password=${pw}`);
    if (res.ok) setFaculty(await res.json());
  }, []);

  const handleLogin = async e => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const ok = await loadReservations(password);
      if (!ok) { setAuthError('Incorrect password.'); return; }
      await loadFaculty(password);
      setAuthed(true);
    } finally {
      setAuthLoading(false);
    }
  };

  // Poll reservations every 15s
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => loadReservations(password), 15000);
    return () => clearInterval(id);
  }, [authed, loadReservations, password]);

  const cancelReservation = async id => {
    if (!window.confirm('Cancel this reservation and return the laptop to inventory?')) return;
    await fetch(`${API}/api/admin/reservations/${id}?password=${password}`, { method: 'DELETE' });
    loadReservations(password);
  };

  const exportCsv = () => {
    window.location.href = `${API}/api/admin/reservations/csv?password=${password}`;
  };

  const addFacultyEmails = async e => {
    e.preventDefault();
    setFacultyMsg('');
    setFacultyLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/faculty?password=${password}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailInput }),
      });
      const data = await res.json();
      if (!res.ok) { setFacultyMsg({ error: data.error }); return; }
      setFacultyMsg({ ok: `${data.added} email(s) added successfully.` });
      setEmailInput('');
      loadFaculty(password);
    } finally {
      setFacultyLoading(false);
    }
  };

  const removeFaculty = async id => {
    await fetch(`${API}/api/admin/faculty/${id}?password=${password}`, { method: 'DELETE' });
    setFaculty(f => f.filter(r => r.id !== id));
  };

  // ---------- Login screen ----------
  if (!authed) {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                autoFocus
              />
            </div>
            {authError && <div className="error-msg">{authError}</div>}
            <button className="btn-primary" type="submit" disabled={authLoading}>
              {authLoading ? 'Checking…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const total = reservations.length;
  const blueReserved = reservations.filter(r => r.color === 'Blue').length;
  const yellowReserved = reservations.filter(r => r.color === 'Yellow').length;

  // Display names: Blue = Citrus, Yellow = Indigo
  const colorLabel = (c) => c === 'Blue' ? 'Citrus' : c === 'Yellow' ? 'Indigo' : c;
  const colorClass = (c) => c === 'Blue' ? 'citrus' : c === 'Yellow' ? 'indigo' : c.toLowerCase();

  // ---------- Dashboard ----------
  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <h2>Admin Dashboard</h2>
        <div className="admin-actions">
          <button className="btn-outline" onClick={() => { loadReservations(password); loadFaculty(password); }}>↻ Refresh</button>
          <button className="btn-outline" onClick={() => setAuthed(false)}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'reservations' ? 'active' : ''}`} onClick={() => setActiveTab('reservations')}>
          Reservations
        </button>
        <button className={`tab-btn ${activeTab === 'faculty' ? 'active' : ''}`} onClick={() => setActiveTab('faculty')}>
          Faculty Emails {faculty.length > 0 && <span className="tab-count">{faculty.length}</span>}
        </button>
      </div>

      {/* ── Reservations tab ── */}
      {activeTab === 'reservations' && (
        <>
          <div className="stats-row">
            <div className="stat-card citrus">
              <div className="num">{inventory.blue ?? '—'}</div>
              <div className="lbl">Citrus Remaining</div>
            </div>
            <div className="stat-card indigo">
              <div className="num">{inventory.yellow ?? '—'}</div>
              <div className="lbl">Indigo Remaining</div>
            </div>
            <div className="stat-card total">
              <div className="num">{total}</div>
              <div className="lbl">Total Reserved</div>
            </div>
            <div className="stat-card citrus">
              <div className="num">{blueReserved}</div>
              <div className="lbl">Citrus Reserved</div>
            </div>
            <div className="stat-card indigo">
              <div className="num">{yellowReserved}</div>
              <div className="lbl">Indigo Reserved</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button className="btn-outline" onClick={exportCsv}>⬇ Export CSV</button>
          </div>

          <div className="table-wrap">
            {reservations.length === 0 ? (
              <div className="empty-state">No reservations yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Color</th>
                    <th>Reserved At</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(r => (
                    <tr key={r.id}>
                      <td style={{ color: '#9ca3af', fontSize: '0.8rem' }}>LP-{r.id}</td>
                      <td>{r.name}</td>
                      <td>{r.email}</td>
                      <td><span className={`badge ${colorClass(r.color)}`}>{colorLabel(r.color)}</span></td>
                      <td style={{ color: '#6b7280', fontSize: '0.82rem' }}>{new Date(r.reserved_at + 'Z').toLocaleString()}</td>
                      <td><button className="btn-danger" onClick={() => cancelReservation(r.id)}>Cancel</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Faculty Emails tab ── */}
      {activeTab === 'faculty' && (
        <>
          <div className="card" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Add Approved Faculty Emails</h3>
            <form onSubmit={addFacultyEmails}>
              <div className="form-group">
                <label>Email addresses</label>
                <textarea
                  rows={6}
                  placeholder={"Paste one email per line, or comma-separated:\n\njane@university.edu\njohn@university.edu\n..."}
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); setFacultyMsg(''); }}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '7px', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
              {facultyMsg.ok && <div style={{ color: '#065f46', fontSize: '0.85rem', marginBottom: '0.5rem' }}>✓ {facultyMsg.ok}</div>}
              {facultyMsg.error && <div className="error-msg" style={{ marginBottom: '0.5rem' }}>{facultyMsg.error}</div>}
              <button className="btn-primary" type="submit" disabled={facultyLoading} style={{ width: 'auto', padding: '0.6rem 1.5rem' }}>
                {facultyLoading ? 'Adding…' : 'Add Emails'}
              </button>
            </form>
          </div>

          <div className="table-wrap">
            {faculty.length === 0 ? (
              <div className="empty-state">No faculty emails added yet. Add some above.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Email</th>
                    <th>Added At</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {faculty.map((f, i) => {
                    const hasReserved = reservations.some(r => r.email === f.email);
                    return (
                      <tr key={f.id}>
                        <td style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{i + 1}</td>
                        <td>{f.email}</td>
                        <td style={{ color: '#6b7280', fontSize: '0.82rem' }}>{new Date(f.added_at + 'Z').toLocaleString()}</td>
                        <td>
                          {hasReserved
                            ? <span className="badge blue">Reserved</span>
                            : <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>Pending</span>}
                        </td>
                        <td>
                          <button className="btn-danger" onClick={() => removeFaculty(f.id)} disabled={hasReserved} title={hasReserved ? 'Cannot remove — already reserved' : ''}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
