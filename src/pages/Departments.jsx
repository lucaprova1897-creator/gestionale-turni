import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Departments() {
  const { profile } = useAuth()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#4A90D9')
  const [savingId, setSavingId] = useState(null)

  const orgId = profile?.organization_id

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('organization_id', orgId)
      .order('sort_order')
    setDepartments(data || [])
    setLoading(false)
  }

  async function addDepartment(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const { error } = await supabase.from('departments').insert({
      organization_id: orgId,
      name: newName.trim(),
      color: newColor,
      sort_order: departments.length,
    })
    if (!error) {
      setNewName('')
      setNewColor('#4A90D9')
      load()
    }
  }

  async function updateDepartment(id, fields) {
    setSavingId(id)
    await supabase.from('departments').update(fields).eq('id', id)
    setSavingId(null)
    load()
  }

  async function removeDepartment(id) {
    if (!confirm('Eliminare questo reparto? I dipendenti collegati resteranno ma senza reparto assegnato.')) return
    await supabase.from('departments').delete().eq('id', id)
    load()
  }

  return (
    <div className="admin-page">
      <h2>Reparti</h2>
      <p className="hint">
        Definisci i reparti della tua struttura (es. Sala, Cucina, Reception, Spa).
        Ogni dipendente verrà assegnato a uno di questi.
      </p>

      <form onSubmit={addDepartment} className="inline-form">
        <input
          type="text"
          placeholder="Nome nuovo reparto (es. Sala)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          title="Colore identificativo"
        />
        <button type="submit">Aggiungi reparto</button>
      </form>

      {loading ? (
        <p>Caricamento…</p>
      ) : departments.length === 0 ? (
        <p className="empty-state">Nessun reparto ancora. Aggiungine uno sopra.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Colore</th>
              <th>Nome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id}>
                <td>
                  <input
                    type="color"
                    value={d.color}
                    onChange={(e) => updateDepartment(d.id, { color: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    defaultValue={d.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== d.name) {
                        updateDepartment(d.id, { name: e.target.value.trim() })
                      }
                    }}
                  />
                </td>
                <td>
                  <button className="danger" onClick={() => removeDepartment(d.id)} disabled={savingId === d.id}>
                    Elimina
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
