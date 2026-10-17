import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/appContext.js'
import { useToast } from '../../ui/toastContext.js'
import useConfirm from '../../ui/useConfirm.jsx'
import Modal from '../../ui/Modal.jsx'
import { Field } from '../../ui/Field.jsx'
import CustomerForm from '../CustomerForm.jsx'
import { ATTENDANCE, normalizePhone } from '../../rules.js'

export default function Customers() {
  const { data, updateCustomer, removeCustomer } = useApp()
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // the customer being edited

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = normalizePhone(query)
    return data.customers
      .filter((c) => !q
        || c.name.toLowerCase().includes(q)
        || c.email.toLowerCase().includes(q)
        || (digits && c.phone.includes(digits)))
      .map((c) => {
        const appts = data.appointments.filter((a) => a.customerId === c.id)
        return {
          ...c,
          total: appts.length,
          present: appts.filter((a) => a.attendance === ATTENDANCE.PRESENT).length,
          absent: appts.filter((a) => a.attendance === ATTENDANCE.ABSENT).length,
        }
      })
  }, [data, query])

  const remove = async (c) => {
    const confirmed = await ask({
      title: `Remove ${c.name}?`,
      message: 'Their appointments will be deleted too. This cannot be undone.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!confirmed) return
    removeCustomer(c.id)
    toast(`${c.name} removed.`)
  }

  const saveEdit = (form) => {
    const result = updateCustomer(editing.id, form)
    if (result.ok) {
      toast('Customer updated.')
      setEditing(null)
    }
    return result
  }

  return (
    <section className="card">
      <div className="toolbar">
        <h2>Customers ({rows.length}{query ? ` of ${data.customers.length}` : ''})</h2>
        <Field label="Search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or mobile" />
        </Field>
      </div>

      {rows.length === 0 && (
        <p className="empty">
          {data.customers.length === 0 ? <>No customers yet. <Link to="/admin/add">Add the first one.</Link></> : 'No customers match your search.'}
        </p>
      )}

      {rows.length > 0 && (
        <table className="stack">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Mobile</th><th>Lessons</th><th>Present</th><th>Absent</th><th><span className="visually-hidden">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td data-label="Name">{c.name}</td>
                <td data-label="Email">{c.email}</td>
                <td data-label="Mobile">{c.phone}</td>
                <td data-label="Lessons">{c.total}</td>
                <td data-label="Present"><span className="badge present">{c.present}</span></td>
                <td data-label="Absent"><span className="badge absent">{c.absent}</span></td>
                <td className="row-actions">
                  <button type="button" className="ghost" onClick={() => setEditing(c)}>Edit</button>
                  <button type="button" className="ghost danger" onClick={() => remove(c)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <CustomerForm
            initial={{ name: editing.name, email: editing.email, phone: editing.phone }}
            requirePassword={false}
            submitLabel="Save changes"
            onSubmit={saveEdit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {dialog}
    </section>
  )
}
