import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import ShiftsCalendar from './pages/ShiftsCalendar'
import './App.css'

function AppContent() {
  const { session, profile, loading, signOut } = useAuth()

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
      <ShiftsCalendar />
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
