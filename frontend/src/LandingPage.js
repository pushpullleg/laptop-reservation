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
  Citrus:  { dot: '#c8e23a', label: 'Citrus',  bg: '#f8fce8' },
  Indigo:  { dot: '#4a5fa5', label: 'Indigo',  bg: '#eef0f8' },
};

const ETAMU_LOGO = `${BASE}/images/etamu/etamu-logo.png`;

export default function LandingPage({ onAdminClick }) {
  const [color, setColor]         = useState('Citrus');
  const [slide, setSlide]         = useState(0);
  const [animDir, setAnimDir]     = useState(null);
  const [inventory, setInventory] = useState({ citrus: null, indigo: null });

  const [email, setEmail]           = useState('');
  const [emailState, setEmailState] = useState('idle'); // idle | checking | ok | error
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claimed, setClaimed]       = useState(false);

  const autoRef    = useRef(null);
  const formRef    = useRef(null);
  const images     = IMAGES[color];
  const colorKey   = color.toLowerCase();
  const available  = inventory[colorKey];
  const soldOut    = available === 0;

  /* ── Inventory ── */
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

  /* ── Carousel auto-advance ── */
  const nextSlide = useCallback(() => {
    setAnimDir('left');
    setTimeout(() => { setSlide(s => (s + 1) % images.length); setAnimDir(null); }, 300);
  }, [images.length]);

  useEffect(() => {
    autoRef.current = setInterval(nextSlide, 4000);
    return () => clearInterval(autoRef.current);
  }, [nextSlide]);

  const goSlide = (idx) => {
    clearInterval(autoRef.current);
    setAnimDir(idx > slide ? 'left' : 'right');
    setTimeout(() => { setSlide(idx); setAnimDir(null); }, 300);
    autoRef.current = setInterval(nextSlide, 4000);
  };

  const switchColor = (c) => {
    if (c === color) return;
    setAnimDir('color');
    setTimeout(() => { setColor(c); setSlide(0); setAnimDir(null); }, 250);
  };

  /* ── Email validation (debounced) ── */
  const debounceRef = useRef(null);
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setEmailState('idle');
    setEmailError('');
    clearTimeout(debounceRef.current);
    if (!val) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
    debounceRef.current = setTimeout(() => checkEmail(val), 700);
  };

  const checkEmail = async (val) => {
    setEmailState('checking');
    try {
      const res  = await fetch(`${API}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val }),
      });
      const data = await res.json();
      if (res.ok) { setEmailState('ok'); setEmailError(''); }
      else        { setEmailState('error'); setEmailError(data.error); }
    } catch {
      setEmailState('error');
      setEmailError('Unable to reach server. Please try again shortly.');
    }
  };

  /* ── Claim submission ── */
  const handleClaim = async (e) => {
    e.preventDefault();
    if (emailState !== 'ok' || soldOut) return;
    setSubmitting(true);
    try {
      const backendColor = color === 'Citrus' ? 'Blue' : 'Yellow';
      const res  = await fetch(`${API}/api/reservations`, {
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

  /* ─────────────────────────────────────
     SUCCESS SCREEN
  ───────────────────────────────────── */
  if (claimed) {
    return (
      <div className="lp-success-page">
        <div className="lp-success-inner">
          <img src={ETAMU_LOGO} alt="East Texas A&M" className="lp-success-logo" />
          <div className="lp-success-check">
            <svg viewBox="0 0 52 52" className="lp-checkmark">
              <circle className="lp-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
              <path  className="lp-checkmark-check"  fill="none" d="M14 27l8 8 16-16"/>
            </svg>
          </div>
          <h1 className="lp-success-title">🎉 Your claim has been<br/>successfully recorded!</h1>
          <p className="lp-success-sub">Thank you for submitting your reservation request.</p>
          <div className="lp-success-card">
            <p>Our team has noted the claim request and will review your eligibility shortly.</p>
            <p style={{ marginTop: '0.75rem' }}>You will receive further communication through your staff email.</p>
          </div>
          <div className="lp-success-badge">✅ Claim successfully noted.</div>
          <button className="lp-close-tab-btn" onClick={() => window.close()}>
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────
     MAIN PAGE
  ───────────────────────────────────── */
  return (
    <div className="lp-page">

      {/* ── Deadline banner ── */}
      <div className="lp-deadline">
        <span className="lp-deadline-dot" />
        <span>Claim by <strong>Friday, June 13 at 5:00 PM</strong> — Limited availability</span>
      </div>

      {/* ── Nav — logo only, no text ── */}
      <nav className="lp-nav">
        <img src={ETAMU_LOGO} alt="East Texas A&M" className="lp-nav-logo-img" />
        <button className="lp-nav-admin" onClick={onAdminClick}>Admin</button>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <p className="lp-hero-eyebrow">New</p>
        <h1 className="lp-hero-title">MacBook Neo</h1>
        <p className="lp-hero-sub">Claim yours!</p>
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

      {/* ══════════════════════════════════
          COLOR CHOICE — primary section
      ══════════════════════════════════ */}
      <section className="lp-choose-section" style={{ '--color-bg': COLOR_META[color].bg }}>
        <p className="lp-choose-eyebrow">Step 1</p>
        <h2 className="lp-choose-title">Choose your colour</h2>
        <p className="lp-choose-sub">Select the finish you'd like to claim.</p>

        {/* Big colour cards */}
        <div className="lp-color-cards">
          {Object.entries(COLOR_META).map(([key, meta]) => {
            const inv = inventory[key.toLowerCase()];
            const out = inv === 0;
            return (
              <button
                key={key}
                className={`lp-color-card ${color === key ? 'selected' : ''} ${out ? 'sold-out' : ''}`}
                onClick={() => !out && switchColor(key)}
                disabled={out}
                aria-pressed={color === key}
              >
                <span className="lp-card-swatch" style={{ background: meta.dot }} />
                <span className="lp-card-name">{meta.label}</span>
                {out
                  ? <span className="lp-card-stock out">Unavailable</span>
                  : <span className="lp-card-stock">
                      {inv !== null ? `${inv} remaining` : ''}
                    </span>
                }
                {color === key && !out && (
                  <span className="lp-card-check">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Subtle swatch row */}
        <div className="lp-swatch-row">
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

        {/* Scroll-to-claim hint */}
        {!soldOut && (
          <button
            className="lp-choose-cta"
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            Claim your {color} MacBook <span>↓</span>
          </button>
        )}
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

      {/* ══════════════════════════════════
          CLAIM FORM — Step 2
      ══════════════════════════════════ */}
      <section className="lp-form-section" id="claim" ref={formRef}>
        <div className="lp-form-card">
          <p className="lp-choose-eyebrow" style={{ marginBottom: '0.4rem' }}>Step 2</p>
          <h2 className="lp-form-title">Claim your MacBook Neo</h2>
          <p className="lp-form-sub">
            Reserving the{' '}
            <strong style={{ color: COLOR_META[color].dot === '#c8e23a' ? '#6a7c00' : '#4a5fa5' }}>
              {color}
            </strong>{' '}
            finish. Enter your staff email to confirm.
          </p>

          <form onSubmit={handleClaim} noValidate>
            <div className="lp-input-wrap">
              <input
                type="email"
                className={`lp-input ${emailState === 'ok' ? 'valid' : ''} ${emailState === 'error' ? 'invalid' : ''}`}
                placeholder="you@etamu.edu"
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

            {/* Fixed-height status line — prevents layout shift while typing */}
            <p className={`lp-field-msg ${emailState === 'error' ? 'is-error' : ''} ${emailState === 'ok' ? 'is-ok' : ''}`}>
              {emailState === 'error' ? emailError
                : emailState === 'ok' ? 'Email verified — you\'re on the approved staff list.'
                : ' ' /* non-breaking space keeps height */}
            </p>

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

            {emailState === 'idle' && email === '' && (
              <p className="lp-input-hint">Only approved staff emails are accepted.</p>
            )}
          </form>

          <p className="lp-form-learn">
            Want to know more?{' '}
            <a href="https://www.apple.com/macbook-neo/" target="_blank" rel="noopener noreferrer">
              Explore the full MacBook Neo specs on Apple.com ›
            </a>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <img src={ETAMU_LOGO} alt="East Texas A&M" className="lp-footer-logo" />
        <p>© 2026 East Texas A&M University Staff Laptop Programme.</p>
        <p className="lp-footer-credits">
          Built by <strong>Mukesh Ravichandran</strong> &nbsp;·&nbsp; Admin <strong>Dr. Sherece Shavel</strong>
        </p>
        <p style={{ marginTop: '0.4rem' }}>
          <a href="https://www.apple.com/macbook-neo/" target="_blank" rel="noopener noreferrer" className="lp-footer-link">
            Apple MacBook Neo
          </a>
          {' '}&nbsp;·&nbsp; For approved staff only.
        </p>
      </footer>

    </div>
  );
}
