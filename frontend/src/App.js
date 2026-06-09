import { useState } from 'react';
import LandingPage from './LandingPage';
import AdminPortal from './AdminPortal';
import './App.css';

export default function App() {
  const [view, setView] = useState('landing');

  if (view === 'admin') {
    return (
      <div>
        <div style={{ background: '#f5f5f7', borderBottom: '1px solid #d2d2d7', padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setView('landing')} style={{ background: 'none', border: 'none', color: '#0071e3', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Back to page
          </button>
          <span style={{ color: '#6e6e73', fontSize: '0.9rem' }}>Admin Dashboard</span>
        </div>
        <div style={{ padding: '2rem 1.5rem' }}>
          <AdminPortal />
        </div>
      </div>
    );
  }

  return <LandingPage onAdminClick={() => setView('admin')} />;
}
