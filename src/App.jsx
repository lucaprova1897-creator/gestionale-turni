import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import ShiftsCalendar from './pages/ShiftsCalendar'
import Departments from './pages/Departments'
import Employees from './pages/Employees'
import TimeOff from './pages/TimeOff'
import Tips from './pages/Tips'
import './App.css'

function AppContent() {
  const { session, profile, loading, isAdmin, signOut } = useAuth()
  const [tab, setTab] = useState('calendar')

  if (loading) return <p style={{ padding: '2rem' }}>Caricamento…</p>
  if (!session) return <Login />

  return (
    <div className="app">
      <header className="app-header">
        <h1>{profile?.organizations?.name || 'Gestionale Turni'}</h1>
        <div>
          <span>{profile?.full_name}</span>
          <button onClick={signOut}>Esci</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
          Calendario
        </button>
        <button className={tab === 'timeoff' ? 'active' : ''} onClick={() => setTab('timeoff')}>
          Ferie e riposi
        </button>
        {isAdmin && (
          <>
            <button className={tab === 'departments' ? 'active' : ''} onClick={() => setTab('departments')}>
              Reparti
            </button>
            <button className={tab === 'employees' ? 'active' : ''} onClick={() => setTab('employees')}>
              Dipendenti
            </button>
            <button className={tab === 'tips' ? 'active' : ''} onClick={() => setTab('tips')}>
              Mance
            </button>
          </>
        )}
      </nav>

      {tab === 'calendar' && <ShiftsCalendar />}
      {tab === 'timeoff' && <TimeOff />}
      {tab === 'departments' && isAdmin && <Departments />}
      {tab === 'employees' && isAdmin && <Employees />}
      {tab === 'tips' && isAdmin && <Tips />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
