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
    `${BASE}/images/indigo/macbook-neo-color-select-202603-indigo.webp`,
    `${BASE}/images/indigo/macbook-neo-color-select-202603-indigo_AV1.webp`,
    `${BASE}/images/indigo/macbook-neo-color-select-202603-indigo_AV2.webp`,
    `${BASE}/images/indigo/macbook-neo-color-select-202603-indigo_AV3.webp`,
  ],
};

const COLOR_META = {
  Citrus: { dot: '#c8e23a', label: 'Citrus' },
  Indigo: { dot: '#4a5fa5', label: 'Indigo' },
};

const ETAMU_LOGO = `${BASE}/images/etamu/etamu-logo.png`;

export default function LandingPage({ onAdminClick }) {
  const [color, setColor] = useState('Citrus');
  const [slide, setSlide] = useState(0);
  const [animDir, setAnimDir] = useState(null);
  const [inventory, setInventory] = useState({ citrus: null, indigo: null });

  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState('idle');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const autoRef = useRef(null);
  const images = IMAGES[color];

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
    setTimeout(() => { setColor(c); setSlide(0); setAnimDir(null); }, 250);
  };

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

  // ── Success screen ──
  if (claimed) {
    return (
      <div className="lp-success-page">
        <div className="lp-success-inner">
          <img src={ETAMU_LOGO} alt="East Texas A&M" className="lp-success-logo" />
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
        <img src={ETAMU_LOGO} alt="East Texas A&M" className="lp-nav-logo-img" />
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
        <a
          href="https://www.apple.com/macbook-neo/"
          target="_blank"
          rel="noopener noreferrer"
          className="lp-learn-more"
        >
          Learn more about MacBook Neo <span className="lp-chevron">›</span>
        </a>
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
            <span
              key={key}
              className={`lp-color-name ${color === key ? 'active' : ''}`}
              onClick={() => switchColor(key)}
            >
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
          <p className="lp-form-sub">
            Enter your faculty email to reserve your <strong>{color}</strong> MacBook Neo.
          </p>

          <form onSubmit={handleClaim} noValidate>
            <div className="lp-input-wrap">
              <input
                type="email"
                className={`lp-input ${emailState === 'ok' ? 'valid' : ''} ${emailState === 'error' ? 'invalid' : ''}`}
                placeholder="your@tamuc.edu"
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

            {emailState === 'error' && <p className="lp-field-error">{emailError}</p>}
            {emailState === 'ok'    && <p className="lp-field-ok">Email verified — you're on the approved list.</p>}

            <button
              className="lp-claim-btn"
              type="submit"
              disabled={emailState !== 'ok' || submitting || soldOut}
            >
              {submitting
                ? <><span className="lp-btn-spinner" /> Claiming…</>
                : soldOut ? `${color} is unavailable`
                : 'Claim My MacBook'}
            </button>
          </form>

          {/* "Want to know more" link — subtle, below the CTA */}
          <p className="lp-form-learn">
            Want to know more?{' '}
            <a
              href="https://www.apple.com/macbook-neo/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore the full MacBook Neo specs on Apple.com ›
            </a>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <img src={ETAMU_LOGO} alt="East Texas A&M" className="lp-footer-logo" />
        <p>© 2026 East Texas A&M University Faculty Laptop Programme.</p>
        <p style={{ marginTop: '0.3rem' }}>
          <a
            href="https://www.apple.com/macbook-neo/"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-footer-link"
          >
            Apple MacBook Neo
          </a>
          {' · '}For approved faculty only.
        </p>
      </footer>

    </div>
  );
}
