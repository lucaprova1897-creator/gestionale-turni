import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function monthsBetween(start, end) {
  if (!start) return 0
  const s = new Date(start)
  const e = new Date(end)
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (e.getDate() < s.getDate()) months -= 1
  return Math.max(0, months)
}

export default function TimeOff() {
  const { profile, isAdmin } = useAuth()
  const [employees, setEmployees] = useState([])
  const [ferieCounts, setFerieCounts] = useState({}) // employee_id -> count di turni 'ferie'
  const [loading, setLoading] = useState(true)

  const orgId = profile?.organization_id

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  async function load() {
    setLoading(true)
    const { data: emp } = await supabase
      .from('employees')
      .select('*')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('full_name')

    const { data: ferieShifts } = await supabase
      .from('shifts')
      .select('employee_id')
      .eq('organization_id', orgId)
      .eq('status', 'ferie')
      .lte('date', new Date().toISOString().slice(0, 10))

    const counts = {}
    ;(ferieShifts || []).forEach((s) => {
      counts[s.employee_id] = (counts[s.employee_id] || 0) + 1
    })

    setEmployees(emp || [])
    setFerieCounts(counts)
    setLoading(false)
  }

  async function updateEmployee(id, field, value) {
    await supabase.from('employees').update({ [field]: value || null }).eq('id', id)
    load()
  }

  function computeBalance(emp) {
    const accrued = monthsBetween(emp.start_date, new Date()) * (emp.monthly_rest_allowance ?? 4)
    const used = ferieCounts[emp.id] || 0
    return accrued - used
  }

  const visibleEmployees = isAdmin
    ? employees
    : employees.filter((e) => e.id === profile?.employee_id)

  return (
    <div className="admin-page">
      <h2>Ferie e riposi</h2>
      <p className="hint">
        Il saldo si calcola così: mesi trascorsi dalla data di inizio rapporto ×
        riposi/ferie spettanti al mese, meno i giorni di ferie già registrati nel
        calendario. Un saldo negativo indica riposi/ferie ancora da recuperare a favore
        del dipendente; un saldo positivo indica ferie maturate non ancora godute.
        {!isAdmin && ' Puoi vedere solo il tuo saldo.'}
      </p>

      {loading ? (
        <p>Caricamento…</p>
      ) : visibleEmployees.length === 0 ? (
        <p className="empty-state">Nessun dato disponibile.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Dipendente</th>
              {isAdmin && <th>Data inizio</th>}
              {isAdmin && <th>Riposi/mese</th>}
              <th>Ferie usate</th>
              <th>Saldo attuale</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((emp) => {
              const balance = computeBalance(emp)
              const balanceClass =
                balance > 0 ? 'balance-positive' : balance < 0 ? 'balance-negative' : 'balance-zero'
              return (
                <tr key={emp.id}>
                  <td>{emp.full_name}</td>
                  {isAdmin && (
                    <td>
                      <input
                        type="date"
                        defaultValue={emp.start_date || ''}
                        onBlur={(e) => updateEmployee(emp.id, 'start_date', e.target.value)}
                      />
                    </td>
                  )}
                  {isAdmin && (
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        defaultValue={emp.monthly_rest_allowance ?? 4}
                        onBlur={(e) => updateEmployee(emp.id, 'monthly_rest_allowance', e.target.value)}
                      />
                    </td>
                  )}
                  <td>{ferieCounts[emp.id] || 0}</td>
                  <td className={balanceClass}>{balance > 0 ? `+${balance}` : balance}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
