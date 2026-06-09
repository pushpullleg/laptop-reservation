import { useState } from 'react';
import FacultyPortal from './FacultyPortal';
import AdminPortal from './AdminPortal';
import './App.css';

export default function App() {
  const [view, setView] = useState('faculty');

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo">🖥️ Laptop Reservation</h1>
          <nav className="nav">
            <button
              className={`nav-btn ${view === 'faculty' ? 'active' : ''}`}
              onClick={() => setView('faculty')}
            >
              Reserve
            </button>
            <button
              className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
              onClick={() => setView('admin')}
            >
              Admin
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {view === 'faculty' ? <FacultyPortal /> : <AdminPortal />}
      </main>
    </div>
  );
}
