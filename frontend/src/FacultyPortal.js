import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const socket = io(API, { autoConnect: true });

// Steps: 'email' → 'details' → 'success'
export default function FacultyPortal() {
  const [step, setStep] = useState('email');
  const [inventory, setInventory] = useState({ blue: null, yellow: null });
  const [connected, setConnected] = useState(false);

  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/inventory`).then(r => r.json()).then(setInventory).catch(() => {});
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('inventory_update', setInventory);
    return () => {
      socket.off('inventory_update', setInventory);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  // Step 1: verify email is on approved list and not already used
  const handleEmailCheck = async e => {
    e.preventDefault();
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await fetch(`${API}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailError(data.error); return; }
      setStep('details');
    } catch {
      setEmailError('Could not connect to server. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Step 2: submit name + color
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitError('');
    if (!color) { setSubmitError('Please select a laptop color.'); return; }
    setSubmitLoading(true);
    try {
      const res = await fetch(`${API}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, color }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error); return; }
      setConfirmed(data);
      setStep('success');
    } catch {
      setSubmitError('Could not connect to server. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const reset = () => {
    setStep('email');
    setEmail(''); setName(''); setColor('');
    setEmailError(''); setSubmitError('');
    setConfirmed(null);
  };

  // --- Success screen ---
  if (step === 'success') {
    return (
      <div className="success-card">
        <div className="success-icon">✅</div>
        <h2>Reservation Confirmed!</h2>
        <div className="reservation-id">{confirmed.id}</div>
        <p>Your <strong>{confirmed.color}</strong> laptop has been reserved.<br />Keep your Reservation ID for your records.</p>
        <button className="btn-secondary" onClick={reset}>Make Another Reservation</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem' }}>Reserve a Laptop</h2>
        {connected && <span style={{ fontSize: '0.78rem', color: '#6b7280' }}><span className="live-dot" />Live</span>}
      </div>

      {/* Always show available counts — nothing else */}
      <div className="inventory-row">
        <div className="inv-badge blue">
          <span className="count">{inventory.blue ?? '—'}</span>
          <span className="label">Blue Available</span>
        </div>
        <div className="inv-badge yellow">
          <span className="count">{inventory.yellow ?? '—'}</span>
          <span className="label">Yellow Available</span>
        </div>
      </div>

      {/* Step 1: Email verification */}
      {step === 'email' && (
        <form onSubmit={handleEmailCheck}>
          <div className="form-group">
            <label>University Email</label>
            <input
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(''); }}
              required
              autoFocus
            />
          </div>
          {emailError && <div className="error-msg">{emailError}</div>}
          <button className="btn-primary" type="submit" disabled={emailLoading}>
            {emailLoading && <span className="spinner" />}
            {emailLoading ? 'Checking…' : 'Continue'}
          </button>
        </form>
      )}

      {/* Step 2: Name + color */}
      {step === 'details' && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>University Email</label>
            <input type="text" value={email} disabled style={{ background: '#f9fafb', color: '#6b7280' }} />
          </div>

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Preferred Color</label>
            <div className="color-options">
              {['Blue', 'Yellow'].map(c => {
                const key = c.toLowerCase();
                const soldOut = inventory[key] === 0;
                return (
                  <button
                    type="button"
                    key={c}
                    className={`color-option ${key} ${color === c ? 'selected' : ''}`}
                    disabled={soldOut}
                    onClick={() => setColor(c)}
                  >
                    <span className={`color-dot ${key}`} />
                    {c}
                    {soldOut && <span className="sold-out">Sold out</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {submitError && <div className="error-msg">{submitError}</div>}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setStep('email')} style={{ flex: '0 0 auto' }}>
              ← Back
            </button>
            <button className="btn-primary" type="submit" disabled={submitLoading} style={{ marginTop: 0 }}>
              {submitLoading && <span className="spinner" />}
              {submitLoading ? 'Reserving…' : 'Reserve Laptop'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
