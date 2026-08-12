import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Tips() {
  const { profile } = useAuth()
  const [periods, setPeriods] = useState([])
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [allocations, setAllocations] = useState([]) // tutte, filtrate per periodo aperto
  const [loading, setLoading] = useState(true)
  const [openPeriodId, setOpenPeriodId] = useState(null)

  const [newPeriod, setNewPeriod] = useState({ name: '', start_date: '', end_date: '' })

  const orgId = profile?.organization_id

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  async function load() {
    setLoading(true)
    const [{ data: per }, { data: dep }, { data: emp }] = await Promise.all([
      supabase.from('tip_periods').select('*').eq('organization_id', orgId).order('start_date', { ascending: false }),
      supabase.from('departments').select('*').eq('organization_id', orgId).order('sort_order'),
      supabase.from('employees').select('*').eq('organization_id', orgId).eq('active', true),
    ])
    setPeriods(per || [])
    setDepartments(dep || [])
    setEmployees(emp || [])
    setLoading(false)
  }

  async function loadAllocations(periodId) {
    const { data } = await supabase.from('tip_allocations').select('*').eq('tip_period_id', periodId)
    setAllocations(data || [])
  }

  async function addPeriod(e) {
    e.preventDefault()
    if (!newPeriod.name.trim()) return
    const { data, error } = await supabase
      .from('tip_periods')
      .insert({
        organization_id: orgId,
        name: newPeriod.name.trim(),
        start_date: newPeriod.start_date || null,
        end_date: newPeriod.end_date || null,
      })
      .select()
      .single()
    if (!error) {
      setNewPeriod({ name: '', start_date: '', end_date: '' })
      await load()
      openPeriod(data.id)
    }
  }

  async function removePeriod(id) {
    if (!confirm('Eliminare questo periodo e tutte le allocazioni collegate?')) return
    await supabase.from('tip_periods').delete().eq('id', id)
    if (openPeriodId === id) setOpenPeriodId(null)
    load()
  }

  async function openPeriod(id) {
    setOpenPeriodId(id)
    await loadAllocations(id)
  }

  async function setAllocationAmount(departmentId, amount) {
    const existing = allocations.find((a) => a.department_id === departmentId)
    if (existing) {
      await supabase.from('tip_allocations').update({ amount }).eq('id', existing.id)
    } else {
      await supabase.from('tip_allocations').insert({
        tip_period_id: openPeriodId,
        department_id: departmentId,
        amount,
      })
    }
    loadAllocations(openPeriodId)
  }

  async function updateDivisor(empId, value) {
    await supabase.from('employees').update({ tip_share_divisor: value || 1 }).eq('id', empId)
    load()
  }

  function distributionFor(departmentId) {
    const alloc = allocations.find((a) => a.department_id === departmentId)
    const amount = alloc?.amount || 0
    const deptEmployees = employees.filter((e) => e.department_id === departmentId)
    const totalShares = deptEmployees.reduce((sum, e) => sum + 1 / (e.tip_share_divisor || 1), 0)
    if (totalShares === 0) return { amount, rows: [] }
    const perShare = amount / totalShares
    const rows = deptEmployees.map((e) => ({
      employee: e,
      share: 1 / (e.tip_share_divisor || 1),
      value: perShare * (1 / (e.tip_share_divisor || 1)),
    }))
    return { amount, rows }
  }

  const openPeriodData = periods.find((p) => p.id === openPeriodId)

  return (
    <div className="admin-page">
      <h2>Mance</h2>
      <p className="hint">
        Crea un periodo (es. "Inverno 2026"), inserisci l'importo raccolto per reparto,
        e la quota di ciascun dipendente si calcola automaticamente. Chi lavora part-time
        può avere un divisore (es. 1.5, 2) impostato nella tabella dipendenti qui sotto,
        così riceve una quota proporzionalmente ridotta.
      </p>

      <form onSubmit={addPeriod} className="inline-form">
        <input
          type="text"
          placeholder="Nome periodo (es. Inverno 2026)"
          value={newPeriod.name}
          onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
        />
        <input
          type="date"
          value={newPeriod.start_date}
          onChange={(e) => setNewPeriod({ ...newPeriod, start_date: e.target.value })}
        />
        <input
          type="date"
          value={newPeriod.end_date}
          onChange={(e) => setNewPeriod({ ...newPeriod, end_date: e.target.value })}
        />
        <button type="submit">Crea periodo</button>
      </form>

      {loading ? (
        <p>Caricamento…</p>
      ) : periods.length === 0 ? (
        <p className="empty-state">Nessun periodo ancora creato.</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => openPeriod(p.id)}
              style={{
                padding: '0.5rem 0.9rem',
                borderRadius: '20px',
                border: '1px solid #e7e9ee',
                background: openPeriodId === p.id ? '#3457d5' : 'white',
                color: openPeriodId === p.id ? 'white' : '#1a1d29',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {openPeriodData && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>{openPeriodData.name}</h3>
            <button className="danger" onClick={() => removePeriod(openPeriodData.id)}>Elimina periodo</button>
          </div>

          {departments.length === 0 ? (
            <p className="empty-state">Crea prima almeno un reparto nella sezione Reparti.</p>
          ) : (
            departments.map((dep) => {
              const dist = distributionFor(dep.id)
              return (
                <div key={dep.id} style={{ marginBottom: '1.5rem' }}>
                  <div className="inline-form" style={{ marginBottom: '0.75rem' }}>
                    <span
                      className="dept-dot"
                      style={{ background: dep.color, display: 'inline-block', width: 8, height: 8, borderRadius: '50%' }}
                    />
                    <strong>{dep.name}</strong>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Importo raccolto (€)"
                      defaultValue={allocations.find((a) => a.department_id === dep.id)?.amount || ''}
                      onBlur={(e) => setAllocationAmount(dep.id, parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {dist.rows.length === 0 ? (
                    <p className="empty-state">Nessun dipendente in questo reparto.</p>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Dipendente</th>
                          <th>Divisore quota</th>
                          <th>Importo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dist.rows.map((r) => (
                          <tr key={r.employee.id}>
                            <td>{r.employee.full_name}</td>
                            <td>
                              <input
                                type="number"
                                step="0.1"
                                min="1"
                                defaultValue={r.employee.tip_share_divisor || 1}
                                onBlur={(e) => updateDivisor(r.employee.id, parseFloat(e.target.value) || 1)}
                              />
                            </td>
                            <td>€ {r.value.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
