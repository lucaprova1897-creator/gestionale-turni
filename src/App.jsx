import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import ShiftsCalendar from './pages/ShiftsCalendar'
import Departments from './pages/Departments'
import Employees from './pages/Employees'
import './App.css'

function AppContent() {
  const { session, profile, loading, isAdmin, signOut } = useAuth()
  const [tab, setTab] = useState('calendar')

  if (loading) return <p>Caricamento…</p>
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

      {isAdmin && (
        <nav className="tabs">
          <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
            Calendario
          </button>
          <button className={tab === 'departments' ? 'active' : ''} onClick={() => setTab('departments')}>
            Reparti
          </button>
          <button className={tab === 'employees' ? 'active' : ''} onClick={() => setTab('employees')}>
            Dipendenti
          </button>
        </nav>
      )}

      {tab === 'calendar' && <ShiftsCalendar />}
      {tab === 'departments' && isAdmin && <Departments />}
      {tab === 'employees' && isAdmin && <Employees />}
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
