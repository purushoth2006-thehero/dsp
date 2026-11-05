import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/appContext.js'
import { useToast } from '../../ui/toastContext.js'
import useConfirm from '../../ui/useConfirm.jsx'
import Modal from '../../ui/Modal.jsx'
import { Field } from '../../ui/Field.jsx'
import SortBar from '../../ui/SortBar.jsx'
import CustomerForm from '../CustomerForm.jsx'
import ScheduleSheet from '../ScheduleSheet.jsx'
import { ATTENDANCE, normalizePhone, packageOf, sortRows } from '../../rules.js'

const SORTS = [
  { key: 'name', label: 'Name' },
  { key: 'mobile', label: 'Mobile number' },
  { key: 'package', label: 'Package' },
  { key: 'total', label: 'Lessons booked' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
]
const KEYS = {
  name: (c) => c.name,
  mobile: (c) => c.phone,
  package: (c) => packageOf(c).lessons,
  total: (c) => c.total,
  present: (c) => c.present,
  absent: (c) => c.absent,
}

export default function Customers() {
  const { data, updateCustomer, removeCustomer } = useApp()
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [editing, setEditing] = useState(null) // the customer being edited
  const [printing, setPrinting] = useState(null) // the customer whose schedule is being printed

  // Open the print dialog for the chosen customer, then go back to the normal page.
  useEffect(() => {
    if (!printing) return undefined
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done)
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [printing])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = normalizePhone(query)
    const list = data.customers
      .filter((c) => !q
        || c.name.toLowerCase().includes(q)
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
    return sortRows(list, KEYS, sort.key, sort.dir)
  }, [data, query, sort])

  const remove = async (c) => {
    const confirmed = await ask({
      title: `Remove ${c.name}?`,
      message: 'Their lessons will be deleted too. This cannot be undone.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!confirmed) return
    const result = await removeCustomer(c.id)
    toast(result.ok ? `${c.name} removed.` : result.error, result.ok ? 'ok' : 'error')
  }

  const saveEdit = async (form) => {
    const result = await updateCustomer(editing.id, form)
    if (result.ok) {
      toast('Student updated.')
      setEditing(null)
    }
    return result
  }

  return (
    <>
    <section className="card no-print">
      <div className="toolbar">
        <h2>Customers ({rows.length}{query ? ` of ${data.customers.length}` : ''})</h2>
        <Field label="Search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or mobile" />
        </Field>
        <SortBar options={SORTS} sort={sort} onChange={setSort} />
      </div>

      {rows.length === 0 && (
        <p className="empty">
          {data.customers.length === 0 ? <>No students yet. <Link to="/admin/add">Add the first one.</Link></> : 'No students match your search.'}
        </p>
      )}

      {rows.length > 0 && (
        <table className="stack">
          <thead>
            <tr><th>Name</th><th>Mobile</th><th>Package</th><th>Lessons</th><th>Present</th><th>Absent</th><th><span className="visually-hidden">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td data-label="Name">{c.name}</td>
                <td data-label="Mobile">{c.phone}</td>
                <td data-label="Package">{packageOf(c).label.split(' (')[0]}</td>
                <td data-label="Lessons">{c.total}/{packageOf(c).lessons}</td>
                <td data-label="Present"><span className="badge present">{c.present}</span></td>
                <td data-label="Absent"><span className="badge absent">{c.absent}</span></td>
                <td className="row-actions">
                  <button type="button" className="ghost" onClick={() => setPrinting(c)}>Print schedule</button>
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
            initial={{ name: editing.name, phone: editing.phone, package: editing.package }}
            packageLocked={data.appointments.some((a) => a.customerId === editing.id)}
            requirePassword={false}
            submitLabel="Save changes"
            onSubmit={saveEdit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {dialog}
    </section>
    {printing && <ScheduleSheet customer={printing} appointments={data.appointments} />}
    </>
  )
}
