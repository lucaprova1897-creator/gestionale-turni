import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Ritorna le date (lun-dom) della settimana contenente `date`
function getWeekDates(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // 0 = lunedì
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return dt
  })
}

export default function ShiftsCalendar() {
  const { profile, isAdmin } = useAuth()
  const [weekStart, setWeekStart] = useState(new Date())
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  const weekDates = getWeekDates(weekStart)
  const orgId = profile?.organization_id

  useEffect(() => {
    if (!orgId) return
    loadData()
  }, [orgId, weekStart])

  async function loadData() {
    setLoading(true)
    const from = weekDates[0].toISOString().slice(0, 10)
    const to = weekDates[6].toISOString().slice(0, 10)

    const [{ data: emp }, { data: dep }, { data: sh }] = await Promise.all([
      supabase.from('employees').select('*').eq('organization_id', orgId).eq('active', true),
      supabase.from('departments').select('*').eq('organization_id', orgId).order('sort_order'),
      supabase.from('shifts').select('*').eq('organization_id', orgId).gte('date', from).lte('date', to),
    ])

    setEmployees(emp || [])
    setDepartments(dep || [])
    setShifts(sh || [])
    setLoading(false)
  }

  function shiftsFor(employeeId, date) {
    const dateStr = date.toISOString().slice(0, 10)
    return shifts.filter((s) => s.employee_id === employeeId && s.date === dateStr)
  }

  function changeWeek(delta) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
  }

  const visibleEmployees = isAdmin
    ? employees
    : employees.filter((e) => e.id === profile?.employee_id)

  return (
    <div className="shifts-calendar">
      <div className="calendar-header">
        <button onClick={() => changeWeek(-1)}>&larr; Settimana prec.</button>
        <span>
          {weekDates[0].toLocaleDateString('it-IT')} – {weekDates[6].toLocaleDateString('it-IT')}
        </span>
        <button onClick={() => changeWeek(1)}>Settimana succ. &rarr;</button>
      </div>

      {loading ? (
        <p>Caricamento…</p>
      ) : (
        <table className="calendar-grid">
          <thead>
            <tr>
              <th>Dipendente</th>
              {weekDates.map((d) => (
                <th key={d.toISOString()}>
                  {d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  {emp.full_name}
                  <br />
                  <small>{departments.find((d) => d.id === emp.department_id)?.name}</small>
                </td>
                {weekDates.map((date) => {
                  const dayShifts = shiftsFor(emp.id, date)
                  return (
                    <td key={date.toISOString()} className="shift-cell">
                      {dayShifts.map((s) => (
                        <div key={s.id} className={`shift-badge status-${s.status}`}>
                          {s.status === 'scheduled'
                            ? `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`
                            : s.status}
                        </div>
                      ))}
                      {isAdmin && dayShifts.length === 0 && (
                        <button className="add-shift-btn" title="Aggiungi turno">
                          +
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
