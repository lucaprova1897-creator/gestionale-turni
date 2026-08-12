import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ShiftModal from './ShiftModal'

function getWeekDates(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return dt
  })
}

function isToday(date) {
  const now = new Date()
  return date.toDateString() === now.toDateString()
}

const STATUS_LABELS = {
  ferie: 'Ferie',
  permesso: 'Permesso',
  malattia: 'Malattia',
  cancelled: 'Annullato',
}

export default function ShiftsCalendar() {
  const { profile, isAdmin } = useAuth()
  const [weekStart, setWeekStart] = useState(new Date())
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState(null)

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

  function goToday() {
    setWeekStart(new Date())
  }

  function openNewShift(employee, date) {
    setModalState({ employee, date, existingShift: null })
  }

  function openEditShift(employee, date, shift) {
    setModalState({ employee, date, existingShift: shift })
  }

  function closeModal() {
    setModalState(null)
  }

  function handleSaved() {
    setModalState(null)
    loadData()
  }

  function formatBadge(s) {
    if (s.status !== 'scheduled') {
      return { text: STATUS_LABELS[s.status] || s.status, className: `status-${s.status}` }
    }
    const start = s.start_time?.slice(0, 5)
    const end = s.end_time ? s.end_time.slice(0, 5) : '…'
    return { text: `${start}–${end}`, className: 'status-scheduled' }
  }

  const visibleEmployees = isAdmin
    ? employees
    : employees.filter((e) => e.id === profile?.employee_id)

  // Raggruppa i dipendenti per reparto, per una lettura più chiara
  const grouped = departments
    .map((dep) => ({
      dep,
      emps: visibleEmployees.filter((e) => e.department_id === dep.id),
    }))
    .filter((g) => g.emps.length > 0)

  const noDept = visibleEmployees.filter((e) => !e.department_id)
  if (noDept.length > 0) grouped.push({ dep: null, emps: noDept })

  return (
    <div className="shifts-calendar">
      <div className="calendar-header">
        <button className="ghost-btn" onClick={() => changeWeek(-1)}>‹</button>
        <div className="week-range">
          <span>
            {weekDates[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – {weekDates[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button className="today-btn" onClick={goToday}>Oggi</button>
        </div>
        <button className="ghost-btn" onClick={() => changeWeek(1)}>›</button>
      </div>

      {loading ? (
        <p className="loading-text">Caricamento…</p>
      ) : visibleEmployees.length === 0 ? (
        <p className="empty-state">Nessun dipendente attivo. Aggiungine uno dalla sezione Dipendenti.</p>
      ) : (
        <div className="calendar-scroll">
          <table className="calendar-grid">
            <thead>
              <tr>
                <th className="employee-col">Dipendente</th>
                {weekDates.map((d) => (
                  <th key={d.toISOString()} className={isToday(d) ? 'today-col' : ''}>
                    <span className="day-name">{d.toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                    <span className="day-num">{d.getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <>
                  {departments.length > 1 && (
                    <tr className="dept-divider" key={`div-${group.dep?.id || 'none'}`}>
                      <td colSpan={8}>
                        <span
                          className="dept-dot"
                          style={{ background: group.dep?.color || '#999' }}
                        />
                        {group.dep?.name || 'Senza reparto'}
                      </td>
                    </tr>
                  )}
                  {group.emps.map((emp) => (
                    <tr key={emp.id}>
                      <td className="employee-col">
                        <span className="employee-name">{emp.full_name}</span>
                        {emp.role && <span className="employee-role">{emp.role}</span>}
                      </td>
                      {weekDates.map((date) => {
                        const dayShifts = shiftsFor(emp.id, date)
                        return (
                          <td
                            key={date.toISOString()}
                            className={`shift-cell ${isToday(date) ? 'today-col' : ''}`}
                          >
                            {dayShifts.map((s) => {
                              const badge = formatBadge(s)
                              return (
                                <div
                                  key={s.id}
                                  className={`shift-badge ${badge.className}`}
                                  onClick={() => isAdmin && openEditShift(emp, date, s)}
                                >
                                  {badge.text}
                                </div>
                              )
                            })}
                            {isAdmin && (
                              <button
                                className="add-shift-btn"
                                title={dayShifts.length === 0 ? 'Aggiungi turno' : 'Aggiungi altro turno'}
                                onClick={() => openNewShift(emp, date)}
                              >
                                +
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalState && (
        <ShiftModal
          employee={modalState.employee}
          date={modalState.date}
          existingShift={modalState.existingShift}
          orgId={orgId}
          profileId={profile?.id}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
