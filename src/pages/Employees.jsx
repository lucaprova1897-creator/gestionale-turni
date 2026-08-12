import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Employees() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ full_name: '', role: '', department_id: '', phone: '', email: '' })

  const orgId = profile?.organization_id

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  async function load() {
    setLoading(true)
    const [{ data: emp }, { data: dep }] = await Promise.all([
      supabase.from('employees').select('*').eq('organization_id', orgId).order('full_name'),
      supabase.from('departments').select('*').eq('organization_id', orgId).order('sort_order'),
    ])
    setEmployees(emp || [])
    setDepartments(dep || [])
    setLoading(false)
  }

  async function addEmployee(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return
    const { error } = await supabase.from('employees').insert({
      organization_id: orgId,
      full_name: form.full_name.trim(),
      role: form.role.trim() || null,
      department_id: form.department_id || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    })
    if (!error) {
      setForm({ full_name: '', role: '', department_id: '', phone: '', email: '' })
      load()
    }
  }

  async function toggleActive(emp) {
    await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id)
    load()
  }

  async function updateField(id, field, value) {
    await supabase.from('employees').update({ [field]: value || null }).eq('id', id)
    load()
  }

  async function removeEmployee(id) {
    if (!confirm('Eliminare definitivamente questo dipendente? Verranno rimossi anche i suoi turni.')) return
    await supabase.from('employees').delete().eq('id', id)
    load()
  }

  return (
    <div className="admin-page">
      <h2>Dipendenti</h2>
      <p className="hint">
        Aggiungi i dipendenti della tua struttura. Per farli accedere da soli al proprio
        turno, ricorda di creare anche il loro utente di accesso (per ora si fa da Supabase,
        una funzione dedicata arriverà in seguito).
      </p>

      <form onSubmit={addEmployee} className="employee-form">
        <input
          type="text"
          placeholder="Nome e cognome"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Ruolo (es. cameriere)"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />
        <select
          value={form.department_id}
          onChange={(e) => setForm({ ...form, department_id: e.target.value })}
        >
          <option value="">Nessun reparto</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Telefono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <button type="submit">Aggiungi dipendente</button>
      </form>

      {loading ? (
        <p>Caricamento…</p>
      ) : employees.length === 0 ? (
        <p className="empty-state">Nessun dipendente ancora. Aggiungine uno sopra.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Reparto</th>
              <th>Attivo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className={!emp.active ? 'inactive-row' : ''}>
                <td>
                  <input
                    type="text"
                    defaultValue={emp.full_name}
                    onBlur={(e) => e.target.value.trim() && updateField(emp.id, 'full_name', e.target.value.trim())}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    defaultValue={emp.role || ''}
                    onBlur={(e) => updateField(emp.id, 'role', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    defaultValue={emp.department_id || ''}
                    onChange={(e) => updateField(emp.id, 'department_id', e.target.value)}
                  >
                    <option value="">Nessuno</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={emp.active} onChange={() => toggleActive(emp)} />
                </td>
                <td>
                  <button className="danger" onClick={() => removeEmployee(emp.id)}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
