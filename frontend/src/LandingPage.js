import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './LandingPage.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const socket = io(API, { autoConnect: true });

const BASE = process.env.PUBLIC_URL || '';
const IMAGES = {
  Citrus: [
    `${BASE}/images/citrus/macbook-neo-color-select-202603-citrus.webp`,
    `${BASE}/images/citrus/macbook-neo-color-select-202603-citrus_AV1.webp`,
    `${BASE}/images/citrus/macbook-neo-color-select-202603-citrus_AV2.webp`,
    `${BASE}/images/citrus/macbook-neo-color-select-202603-citrus_AV3.webp`,
  ],
  Indigo: [
    `${BASE}/images/indigo/macbook-neo-color-select-202603-indigo_AV1.webp`,
    `${BASE}/images/indigo/macbook-neo-color-select-202603-indigo_AV2.webp`,
    `${BASE}/images/indigo/macbook-neo-color-select-202603-indigo_AV3.webp`,
  ],
};

const COLOR_META = {
  Citrus: { dot: '#c8e23a', label: 'Citrus' },
  Indigo: { dot: '#4a5fa5', label: 'Indigo' },
};

export default function LandingPage({ onAdminClick }) {
  const [color, setColor] = useState('Citrus');
  const [slide, setSlide] = useState(0);
  const [animDir, setAnimDir] = useState(null); // 'left' | 'right' | 'color'
  const [inventory, setInventory] = useState({ citrus: null, indigo: null });

  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState('idle'); // idle | checking | ok | error
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const autoRef = useRef(null);
  const images = IMAGES[color];

  // Fetch inventory & live updates
  useEffect(() => {
    fetch(`${API}/api/inventory`)
      .then(r => r.json())
      .then(d => setInventory({ citrus: d.blue, indigo: d.yellow }))
      .catch(() => {});
    socket.on('inventory_update', d =>
      setInventory({ citrus: d.blue, indigo: d.yellow })
    );
    return () => socket.off('inventory_update');
  }, []);

  // Auto-advance slide
  const nextSlide = useCallback(() => {
    setAnimDir('left');
    setTimeout(() => {
      setSlide(s => (s + 1) % images.length);
      setAnimDir(null);
    }, 300);
  }, [images.length]);

  useEffect(() => {
    autoRef.current = setInterval(nextSlide, 4000);
    return () => clearInterval(autoRef.current);
  }, [nextSlide]);

  const goSlide = (idx) => {
    clearInterval(autoRef.current);
    const dir = idx > slide ? 'left' : 'right';
    setAnimDir(dir);
    setTimeout(() => { setSlide(idx); setAnimDir(null); }, 300);
    autoRef.current = setInterval(nextSlide, 4000);
  };

  const switchColor = (c) => {
    if (c === color) return;
    setAnimDir('color');
    setTimeout(() => {
      setColor(c);
      setSlide(0);
      setAnimDir(null);
    }, 250);
  };

  // Email validation debounce
  const debounceRef = useRef(null);
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setEmailState('idle');
    setEmailError('');
    clearTimeout(debounceRef.current);
    if (!val) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) return;
    debounceRef.current = setTimeout(() => checkEmail(val), 700);
  };

  const checkEmail = async (val) => {
    setEmailState('checking');
    try {
      const res = await fetch(`${API}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val }),
      });
      const data = await res.json();
      if (res.ok) { setEmailState('ok'); setEmailError(''); }
      else { setEmailState('error'); setEmailError(data.error); }
    } catch {
      setEmailState('idle');
    }
  };

  const handleClaim = async (e) => {
    e.preventDefault();
    if (emailState !== 'ok') return;
    setSubmitting(true);
    try {
      const backendColor = color === 'Citrus' ? 'Blue' : 'Yellow';
      const res = await fetch(`${API}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: email.split('@')[0], email, color: backendColor }),
      });
      if (res.ok) { setClaimed(true); }
      else {
        const d = await res.json();
        setEmailState('error');
        setEmailError(d.error);
      }
    } catch {
      setEmailState('error');
      setEmailError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Claimed success screen ──
  if (claimed) {
    return (
      <div className="lp-success-page">
        <div className="lp-success-inner">
          <div className="lp-success-check">
            <svg viewBox="0 0 52 52" className="lp-checkmark">
              <circle className="lp-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
              <path className="lp-checkmark-check" fill="none" d="M14 27l8 8 16-16"/>
            </svg>
          </div>
          <h1 className="lp-success-title">🎉 Your claim has been<br/>successfully recorded!</h1>
          <p className="lp-success-sub">Thank you for submitting your reservation request.</p>
          <div className="lp-success-card">
            <p>Our team has received your information and will review your eligibility shortly.</p>
            <p style={{ marginTop: '0.75rem' }}>You will receive further communication through your faculty email.</p>
          </div>
          <div className="lp-success-badge">✅ Reservation successfully noted.</div>
        </div>
      </div>
    );
  }

  const colorKey = color.toLowerCase();
  const available = inventory[colorKey];
  const soldOut = available === 0;

  return (
    <div className="lp-page">

      {/* ── Deadline banner ── */}
      <div className="lp-deadline">
        <span className="lp-deadline-dot" />
        <span>Claim by <strong>Friday, June 13</strong> — Limited availability</span>
      </div>

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <span className="lp-nav-logo">
          <svg height="18" viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.5-49 188.6-49 30.7 0 132.5 2.6 198.3 99zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
          </svg>
        </span>
        <span className="lp-nav-title">MacBook Neo</span>
        <button className="lp-nav-admin" onClick={onAdminClick}>Admin</button>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <p className="lp-hero-eyebrow">New</p>
        <h1 className="lp-hero-title">MacBook Neo</h1>
        <p className="lp-hero-sub">Claim yours today.</p>
        <div className="lp-specs">
          <span>13‑inch Display</span>
          <span className="lp-spec-dot">·</span>
          <span>AI8 Pro Chip</span>
          <span className="lp-spec-dot">·</span>
          <span>8GB RAM</span>
          <span className="lp-spec-dot">·</span>
          <span>256GB SSD</span>
        </div>
      </section>

      {/* ── Gallery ── */}
      <section className="lp-gallery-section">
        <div className={`lp-gallery-img-wrap ${animDir ? `anim-${animDir}` : ''}`}>
          <img
            key={`${color}-${slide}`}
            src={images[slide]}
            alt={`MacBook Neo ${color}`}
            className="lp-gallery-img"
          />
        </div>

        {/* Dot nav */}
        <div className="lp-gallery-dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`lp-dot ${i === slide ? 'active' : ''}`}
              onClick={() => goSlide(i)}
              aria-label={`View image ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── Color selector ── */}
      <section className="lp-color-section">
        <p className="lp-color-label">
          Available colours — <strong>{COLOR_META[color].label}</strong>
        </p>
        <div className="lp-color-swatches">
          {Object.entries(COLOR_META).map(([key, meta]) => (
            <button
              key={key}
              className={`lp-swatch ${color === key ? 'active' : ''}`}
              onClick={() => switchColor(key)}
              aria-label={`Select ${meta.label}`}
            >
              <span className="lp-swatch-dot" style={{ background: meta.dot }} />
            </button>
          ))}
        </div>
        <div className="lp-color-names">
          {Object.entries(COLOR_META).map(([key, meta]) => (
            <span key={key} className={`lp-color-name ${color === key ? 'active' : ''}`} onClick={() => switchColor(key)}>
              {meta.label}
            </span>
          ))}
        </div>

        {available !== null && (
          <p className="lp-avail">
            {soldOut
              ? <span className="lp-avail-none">No {color} units remaining</span>
              : <span className="lp-avail-count"><strong>{available}</strong> {color} units available</span>
            }
          </p>
        )}
      </section>

      {/* ── Claim form ── */}
      <section className="lp-form-section" id="claim">
        <div className="lp-form-card">
          <h2 className="lp-form-title">Claim your MacBook Neo</h2>
          <p className="lp-form-sub">Enter your faculty email to reserve your <strong>{color}</strong> MacBook Neo.</p>

          <form onSubmit={handleClaim} noValidate>
            <div className="lp-input-wrap">
              <input
                type="email"
                className={`lp-input ${emailState === 'ok' ? 'valid' : ''} ${emailState === 'error' ? 'invalid' : ''}`}
                placeholder="your@university.edu"
                value={email}
                onChange={handleEmailChange}
                disabled={submitting}
                autoComplete="email"
              />
              <div className="lp-input-status">
                {emailState === 'checking' && <span className="lp-status-spinner" />}
                {emailState === 'ok'       && <span className="lp-status-ok">✓</span>}
                {emailState === 'error'    && <span className="lp-status-err">✕</span>}
              </div>
            </div>

            {emailState === 'error' && (
              <p className="lp-field-error">{emailError}</p>
            )}
            {emailState === 'ok' && (
              <p className="lp-field-ok">Email verified — you're on the approved list.</p>
            )}

            <button
              className="lp-claim-btn"
              type="submit"
              disabled={emailState !== 'ok' || submitting || soldOut}
            >
              {submitting
                ? <><span className="lp-btn-spinner" /> Claiming…</>
                : soldOut
                ? `${color} is unavailable`
                : 'Claim My MacBook'}
            </button>
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <p>Copyright © 2026 University Faculty Laptop Programme.</p>
        <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#aeaeb2' }}>
          MacBook Neo · 13-inch · AI8 Pro · For approved faculty only.
        </p>
      </footer>

    </div>
  );
}
