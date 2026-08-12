import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function eachDate(start, end) {
  const dates = []
  const cursor = new Date(start)
  const last = new Date(end)
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export default function Closures() {
  const { profile } = useAuth()
  const [closures, setClosures] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })

  const orgId = profile?.organization_id

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  async function load() {
    setLoading(true)
    const [{ data: cl }, { data: emp }] = await Promise.all([
      supabase.from('closure_periods').select('*').eq('organization_id', orgId).order('start_date', { ascending: false }),
      supabase.from('employees').select('*').eq('organization_id', orgId).eq('active', true),
    ])
    setClosures(cl || [])
    setEmployees(emp || [])
    setLoading(false)
  }

  async function addClosure(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.start_date || !form.end_date) return
    const { error } = await supabase.from('closure_periods').insert({
      organization_id: orgId,
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
    })
    if (!error) {
      setForm({ name: '', start_date: '', end_date: '' })
      load()
    }
  }

  async function removeClosure(id) {
    if (!confirm('Eliminare questo periodo di chiusura? I turni/ferie già generati non verranno rimossi automaticamente.')) return
    await supabase.from('closure_periods').delete().eq('id', id)
    load()
  }

  async function applyClosure(closure) {
    if (!confirm(
      `Verranno aggiunte "Ferie" per tutti i dipendenti attivi in ogni giorno del periodo "${closure.name}" che non ha già un turno/riposo/ferie/permesso/malattia segnato. ` +
      `Ricorda di segnare PRIMA i riposi previsti in quei giorni (dal calendario), così non verranno sovrascritti. Continuare?`
    )) return

    setApplying(closure.id)
    const dates = eachDate(closure.start_date, closure.end_date)

    const { data: existingShifts } = await supabase
      .from('shifts')
      .select('employee_id,date')
      .eq('organization_id', orgId)
      .gte('date', closure.start_date)
      .lte('date', closure.end_date)

    const existingKeys = new Set((existingShifts || []).map((s) => `${s.employee_id}_${s.date}`))

    const toInsert = []
    for (const emp of employees) {
      for (const date of dates) {
        const key = `${emp.id}_${date}`
        if (!existingKeys.has(key)) {
          toInsert.push({
            organization_id: orgId,
            employee_id: emp.id,
            department_id: emp.department_id,
            date,
            status: 'ferie',
            start_time: '00:00',
            half_day: 'full',
          })
        }
      }
    }

    if (toInsert.length > 0) {
      await supabase.from('shifts').insert(toInsert)
    }

    setApplying(null)
    alert(`Fatto: aggiunti ${toInsert.length} giorni di ferie per il periodo "${closure.name}".`)
  }

  return (
    <div className="admin-page">
      <h2>Chiusure struttura</h2>
      <p className="hint">
        Crea qui un periodo di chiusura. Prima di applicarlo, vai sul Calendario e segna
        manualmente i riposi previsti in quei giorni (es. 1 giorno a settimana per dipendente).
        Poi torna qui e clicca "Applica": tutti i giorni rimasti vuoti in quel periodo verranno
        segnati automaticamente come Ferie per tutto lo staff attivo.
      </p>

      <form onSubmit={addClosure} className="inline-form">
        <input
          type="text"
          placeholder="Nome chiusura (es. Chiusura primaverile)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="date"
          value={form.start_date}
          onChange={(e) => setForm({ ...form, start_date: e.target.value })}
        />
        <input
          type="date"
          value={form.end_date}
          onChange={(e) => setForm({ ...form, end_date: e.target.value })}
        />
        <button type="submit">Crea periodo</button>
      </form>

      {loading ? (
        <p>Caricamento…</p>
      ) : closures.length === 0 ? (
        <p className="empty-state">Nessun periodo di chiusura ancora creato.</p>
      ) : (
        <div className="period-list">
          {closures.map((c) => (
            <div className="period-row" key={c.id}>
              <strong>{c.name}</strong>
              <span>{c.start_date} → {c.end_date}</span>
              <button onClick={() => applyClosure(c)} disabled={applying === c.id}>
                {applying === c.id ? 'Applico…' : 'Applica (genera ferie)'}
              </button>
              <button className="danger" onClick={() => removeClosure(c.id)}>Elimina</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
