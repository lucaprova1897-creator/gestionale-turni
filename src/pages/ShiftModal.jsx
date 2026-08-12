import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Turno' },
  { value: 'riposo', label: 'Riposo' },
  { value: 'ferie', label: 'Ferie' },
  { value: 'permesso', label: 'Permesso' },
  { value: 'malattia', label: 'Malattia' },
]

const HALF_DAY_STATUSES = ['riposo', 'ferie', 'permesso']

function toMinutes(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function durationHours(start, end) {
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s === null || e === null) return 0
  let diff = e - s
  if (diff < 0) diff += 24 * 60 // turno oltre mezzanotte
  return diff / 60
}

function getWeekRange(dateStr) {
  const d = new Date(dateStr)
  const day = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  }
}

export default function ShiftModal({ employee, date, existingShift, orgId, profileId, onClose, onSaved }) {
  const [status, setStatus] = useState(existingShift?.status || 'scheduled')
  const [startTime, setStartTime] = useState(existingShift?.start_time?.slice(0, 5) || '')
  const [endTime, setEndTime] = useState(existingShift?.end_time?.slice(0, 5) || '')
  const [noEndTime, setNoEndTime] = useState(existingShift ? !existingShift.end_time : false)
  const [halfDay, setHalfDay] = useState(existingShift?.half_day || 'full')
  const [certificateProvided, setCertificateProvided] = useState(existingShift?.certificate_provided ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [weekShifts, setWeekShifts] = useState([])

  const dateStr = date.toISOString().slice(0, 10)

  useEffect(() => {
    loadWeekShifts()
  }, [])

  async function loadWeekShifts() {
    const { from, to } = getWeekRange(dateStr)
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('date', from)
      .lte('date', to)
    setWeekShifts((data || []).filter((s) => s.id !== existingShift?.id))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)

    if (status === 'scheduled' && !startTime) {
      setError("Inserisci almeno l'orario di inizio.")
      return
    }

    setSaving(true)

    const payload = {
      organization_id: orgId,
      employee_id: employee.id,
      department_id: employee.department_id,
      date: dateStr,
      status,
      start_time: status === 'scheduled' ? startTime : '00:00',
      end_time: status === 'scheduled' && !noEndTime && endTime ? endTime : null,
      half_day: HALF_DAY_STATUSES.includes(status) ? halfDay : 'full',
      certificate_provided: status === 'malattia' ? certificateProvided : null,
      created_by: profileId,
    }

    let result
    if (existingShift) {
      result = await supabase.from('shifts').update(payload).eq('id', existingShift.id)
    } else {
      result = await supabase.from('shifts').insert(payload)
    }

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
    } else {
      onSaved()
    }
  }

  async function handleDelete() {
    if (!existingShift) return
    if (!confirm('Eliminare questo turno?')) return
    setSaving(true)
    await supabase.from('shifts').delete().eq('id', existingShift.id)
    setSaving(false)
    onSaved()
  }

  // Calcolo ore totali (solo quando c'è un orario di fine)
  const todayHoursOthers = weekShifts
    .filter((s) => s.date === dateStr && s.status === 'scheduled' && s.end_time)
    .reduce((sum, s) => sum + durationHours(s.start_time?.slice(0, 5), s.end_time?.slice(0, 5)), 0)

  const weekHoursOthers = weekShifts
    .filter((s) => s.status === 'scheduled' && s.end_time)
    .reduce((sum, s) => sum + durationHours(s.start_time?.slice(0, 5), s.end_time?.slice(0, 5)), 0)

  const currentDuration =
    status === 'scheduled' && !noEndTime && startTime && endTime ? durationHours(startTime, endTime) : 0

  const showHoursSummary = status === 'scheduled' && !noEndTime && startTime && endTime

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {employee.full_name} — {date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h3>

        <form onSubmit={handleSave}>
          <label>Tipo</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {status === 'scheduled' && (
            <>
              <label>Inizio turno</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={noEndTime}
                  onChange={(e) => setNoEndTime(e.target.checked)}
                />
                Solo orario di inizio (fine non definita)
              </label>

              {!noEndTime && (
                <>
                  <label>Fine turno</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </>
              )}

              {showHoursSummary && (
                <div className="hours-summary">
                  <div>
                    <span>Ore di oggi</span>
                    <strong>{(todayHoursOthers + currentDuration).toFixed(1)} h</strong>
                  </div>
                  <div>
                    <span>Ore di questa settimana</span>
                    <strong>{(weekHoursOthers + currentDuration).toFixed(1)} h</strong>
                  </div>
                </div>
              )}
            </>
          )}

          {HALF_DAY_STATUSES.includes(status) && (
            <>
              <label>Durata</label>
              <select value={halfDay} onChange={(e) => setHalfDay(e.target.value)}>
                <option value="full">Giornata intera</option>
                <option value="morning">Solo mattina</option>
                <option value="afternoon">Solo pomeriggio/sera</option>
              </select>
            </>
          )}

          {status === 'malattia' && (
            <>
              <label>Certificato medico</label>
              <select
                value={certificateProvided === null ? '' : certificateProvided ? 'yes' : 'no'}
                onChange={(e) =>
                  setCertificateProvided(e.target.value === '' ? null : e.target.value === 'yes')
                }
              >
                <option value="">Non specificato</option>
                <option value="yes">Presentato</option>
                <option value="no">Non presentato</option>
              </select>
              {certificateProvided === false && (
                <p className="hint" style={{ margin: '0.3rem 0 0 0' }}>
                  Senza certificato puoi comunque tenerla come malattia, oppure cambiare il "Tipo"
                  sopra in Riposo o Permesso, a tua discrezione.
                </p>
              )}
            </>
          )}

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            {existingShift && (
              <button type="button" className="danger" onClick={handleDelete} disabled={saving}>
                Elimina
              </button>
            )}
            <button type="button" onClick={onClose} disabled={saving}>Annulla</button>
            <button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button>
          </div>
        </form>

        <p className="hint">
          Per un turno spezzato, salva questo blocco e poi aggiungi un secondo turno
          nello stesso giorno con il pulsante "+" nel calendario.
        </p>
      </div>
    </div>
  )
}
