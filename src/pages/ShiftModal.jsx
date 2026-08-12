import { useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Turno' },
  { value: 'ferie', label: 'Ferie' },
  { value: 'permesso', label: 'Permesso' },
  { value: 'malattia', label: 'Malattia' },
]

export default function ShiftModal({ employee, date, existingShift, orgId, profileId, onClose, onSaved }) {
  const [status, setStatus] = useState(existingShift?.status || 'scheduled')
  const [startTime, setStartTime] = useState(existingShift?.start_time?.slice(0, 5) || '')
  const [endTime, setEndTime] = useState(existingShift?.end_time?.slice(0, 5) || '')
  const [noEndTime, setNoEndTime] = useState(existingShift ? !existingShift.end_time : false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dateStr = date.toISOString().slice(0, 10)

  async function handleSave(e) {
    e.preventDefault()
    setError(null)

    if (status === 'scheduled' && !startTime) {
      setError('Inserisci almeno l\'orario di inizio.')
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
          nello stesso giorno con il pulsante "+ aggiungi altro turno" qui sotto.
        </p>
      </div>
    </div>
  )
}
