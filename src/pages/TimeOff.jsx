import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function dayValue(halfDay) {
  return halfDay === 'full' || !halfDay ? 1 : 0.5
}

// Numero di settimane (anche parziali, proporzionali) tra due date
function weeksBetween(start, end) {
  const s = new Date(start)
  const e = new Date(end)
  if (e <= s) return 0
  return (e - s) / (1000 * 60 * 60 * 24 * 7)
}

// Calcola i riposi dovuti in un intervallo, sommando le policy che si sovrappongono
// (default 1/settimana per i giorni non coperti da nessuna policy)
function expectedRestDays(start, end, policies) {
  const s = new Date(start)
  const e = new Date(end < new Date().toISOString().slice(0, 10) ? end : new Date())
  if (e <= s) return 0

  let total = 0
  const cursor = new Date(s)
  while (cursor < e) {
    const dayStr = cursor.toISOString().slice(0, 10)
    const policy = policies.find((p) => dayStr >= p.start_date && dayStr <= p.end_date)
    const dailyRate = (policy ? policy.weekly_rest_days : 1) / 7
    total += dailyRate
    cursor.setDate(cursor.getDate() + 1)
  }
  return total
}

export default function TimeOff() {
  const { profile, isAdmin } = useAuth()
  const [employees, setEmployees] = useState([])
  const [allowances, setAllowances] = useState([])
  const [policies, setPolicies] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  const [newAllowance, setNewAllowance] = useState({ employee_id: '', period_name: '', start_date: '', end_date: '', allowance_days: '' })
  const [newPolicy, setNewPolicy] = useState({ name: '', start_date: '', end_date: '', weekly_rest_days: 1 })

  const orgId = profile?.organization_id

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  async function load() {
    setLoading(true)
    const [{ data: emp }, { data: allow }, { data: pol }, { data: sh }] = await Promise.all([
      supabase.from('employees').select('*').eq('organization_id', orgId).eq('active', true).order('full_name'),
      supabase.from('employee_leave_allowances').select('*').eq('organization_id', orgId),
      supabase.from('rest_day_policies').select('*').eq('organization_id', orgId).order('start_date'),
      supabase.from('shifts').select('employee_id,status,half_day,date').eq('organization_id', orgId)
        .in('status', ['ferie', 'riposo'])
        .lte('date', new Date().toISOString().slice(0, 10)),
    ])
    setEmployees(emp || [])
    setAllowances(allow || [])
    setPolicies(pol || [])
    setShifts(sh || [])
    setLoading(false)
  }

  async function addAllowance(e) {
    e.preventDefault()
    if (!newAllowance.employee_id || !newAllowance.period_name || !newAllowance.start_date || !newAllowance.end_date) return
    const { error } = await supabase.from('employee_leave_allowances').insert({
      organization_id: orgId,
      employee_id: newAllowance.employee_id,
      period_name: newAllowance.period_name.trim(),
      start_date: newAllowance.start_date,
      end_date: newAllowance.end_date,
      allowance_days: parseFloat(newAllowance.allowance_days) || 0,
    })
    if (!error) {
      setNewAllowance({ employee_id: '', period_name: '', start_date: '', end_date: '', allowance_days: '' })
      load()
    }
  }

  async function removeAllowance(id) {
    await supabase.from('employee_leave_allowances').delete().eq('id', id)
    load()
  }

  async function addPolicy(e) {
    e.preventDefault()
    if (!newPolicy.name.trim() || !newPolicy.start_date || !newPolicy.end_date) return
    const { error } = await supabase.from('rest_day_policies').insert({
      organization_id: orgId,
      name: newPolicy.name.trim(),
      start_date: newPolicy.start_date,
      end_date: newPolicy.end_date,
      weekly_rest_days: parseFloat(newPolicy.weekly_rest_days) || 1,
    })
    if (!error) {
      setNewPolicy({ name: '', start_date: '', end_date: '', weekly_rest_days: 1 })
      load()
    }
  }

  async function removePolicy(id) {
    await supabase.from('rest_day_policies').delete().eq('id', id)
    load()
  }

  function ferieDue(empId) {
    return allowances
      .filter((a) => a.employee_id === empId)
      .reduce((sum, a) => sum + Number(a.allowance_days), 0)
  }

  function ferieUsed(empId) {
    return shifts
      .filter((s) => s.employee_id === empId && s.status === 'ferie')
      .reduce((sum, s) => sum + dayValue(s.half_day), 0)
  }

  function restUsed(empId) {
    return shifts
      .filter((s) => s.employee_id === empId && s.status === 'riposo')
      .reduce((sum, s) => sum + dayValue(s.half_day), 0)
  }

  function restDue(emp) {
    if (!emp.start_date) return 0
    return expectedRestDays(emp.start_date, new Date().toISOString().slice(0, 10), policies)
  }

  const visibleEmployees = isAdmin
    ? employees
    : employees.filter((e) => e.id === profile?.employee_id)

  return (
    <div className="admin-page">
      <h2>Ferie e riposi</h2>

      {isAdmin && (
        <>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Ferie spettanti per periodo</h3>
          <p className="hint">
            Aggiungi un periodo (es. "Inverno 2026") con i giorni di ferie spettanti a ciascun
            dipendente. Puoi aggiungerne quanti vuoi nel tempo: il totale dovuto è la somma di
            tutti i periodi inseriti.
          </p>
          <form onSubmit={addAllowance} className="inline-form">
            <select
              value={newAllowance.employee_id}
              onChange={(e) => setNewAllowance({ ...newAllowance, employee_id: e.target.value })}
            >
              <option value="">Dipendente…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            <input
              type="text"
              placeholder="Nome periodo"
              value={newAllowance.period_name}
              onChange={(e) => setNewAllowance({ ...newAllowance, period_name: e.target.value })}
            />
            <input
              type="date"
              value={newAllowance.start_date}
              onChange={(e) => setNewAllowance({ ...newAllowance, start_date: e.target.value })}
            />
            <input
              type="date"
              value={newAllowance.end_date}
              onChange={(e) => setNewAllowance({ ...newAllowance, end_date: e.target.value })}
            />
            <input
              type="number"
              step="0.5"
              placeholder="Giorni spettanti"
              value={newAllowance.allowance_days}
              onChange={(e) => setNewAllowance({ ...newAllowance, allowance_days: e.target.value })}
            />
            <button type="submit">Aggiungi</button>
          </form>

          {allowances.length > 0 && (
            <div className="period-list">
              {allowances.map((a) => (
                <div className="period-row" key={a.id}>
                  <strong>{employees.find((e) => e.id === a.employee_id)?.full_name || '—'}</strong>
                  <span>{a.period_name}</span>
                  <span>{a.start_date} → {a.end_date}</span>
                  <span>{a.allowance_days} giorni</span>
                  <button className="danger" onClick={() => removeAllowance(a.id)}>Elimina</button>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Policy riposi settimanali</h3>
          <p className="hint">
            Definisci quanti riposi a settimana spettano in un dato periodo (es. alta/bassa
            stagione). Per le date non coperte da nessuna policy si assume 1 riposo/settimana.
          </p>
          <form onSubmit={addPolicy} className="inline-form">
            <input
              type="text"
              placeholder="Nome periodo (es. Alta stagione)"
              value={newPolicy.name}
              onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
            />
            <input
              type="date"
              value={newPolicy.start_date}
              onChange={(e) => setNewPolicy({ ...newPolicy, start_date: e.target.value })}
            />
            <input
              type="date"
              value={newPolicy.end_date}
              onChange={(e) => setNewPolicy({ ...newPolicy, end_date: e.target.value })}
            />
            <input
              type="number"
              step="0.5"
              min="0"
              placeholder="Riposi/settimana"
              value={newPolicy.weekly_rest_days}
              onChange={(e) => setNewPolicy({ ...newPolicy, weekly_rest_days: e.target.value })}
            />
            <button type="submit">Aggiungi</button>
          </form>

          {policies.length > 0 && (
            <div className="period-list">
              {policies.map((p) => (
                <div className="period-row" key={p.id}>
                  <strong>{p.name}</strong>
                  <span>{p.start_date} → {p.end_date}</span>
                  <span>{p.weekly_rest_days} riposi/settimana</span>
                  <button className="danger" onClick={() => removePolicy(p.id)}>Elimina</button>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Data di inizio rapporto</h3>
          <p className="hint">Serve per calcolare da quando iniziare a contare i riposi dovuti.</p>
          <table className="admin-table" style={{ marginBottom: '1.5rem' }}>
            <thead><tr><th>Dipendente</th><th>Data inizio</th></tr></thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.full_name}</td>
                  <td>
                    <input
                      type="date"
                      defaultValue={emp.start_date || ''}
                      onBlur={async (e) => {
                        await supabase.from('employees').update({ start_date: e.target.value || null }).eq('id', emp.id)
                        load()
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Saldi attuali</h3>
      {loading ? (
        <p>Caricamento…</p>
      ) : visibleEmployees.length === 0 ? (
        <p className="empty-state">Nessun dato disponibile.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Dipendente</th>
              <th>Ferie dovute</th>
              <th>Ferie usate</th>
              <th>Saldo ferie</th>
              <th>Riposi dovuti</th>
              <th>Riposi goduti</th>
              <th>Saldo riposi</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((emp) => {
              const fDue = ferieDue(emp.id)
              const fUsed = ferieUsed(emp.id)
              const fBalance = fDue - fUsed
              const rDue = restDue(emp)
              const rUsed = restUsed(emp.id)
              const rBalance = rUsed - rDue // positivo = goduti in più del dovuto

              const cls = (v) => (v > 0.01 ? 'balance-positive' : v < -0.01 ? 'balance-negative' : 'balance-zero')

              return (
                <tr key={emp.id}>
                  <td>{emp.full_name}</td>
                  <td>{fDue.toFixed(1)}</td>
                  <td>{fUsed.toFixed(1)}</td>
                  <td className={cls(fBalance)}>{fBalance > 0 ? `+${fBalance.toFixed(1)}` : fBalance.toFixed(1)}</td>
                  <td>{rDue.toFixed(1)}</td>
                  <td>{rUsed.toFixed(1)}</td>
                  <td className={cls(rBalance)}>{rBalance > 0 ? `+${rBalance.toFixed(1)}` : rBalance.toFixed(1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="hint" style={{ marginTop: '0.75rem' }}>
        Saldo riposi positivo = riposi già goduti in più rispetto al dovuto fino ad oggi.
        Saldo ferie positivo = ferie maturate non ancora godute.
      </p>
    </div>
  )
}
