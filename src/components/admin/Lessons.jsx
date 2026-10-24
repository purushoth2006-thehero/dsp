import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/appContext.js'
import { useToast } from '../../ui/toastContext.js'
import useConfirm from '../../ui/useConfirm.jsx'
import useNow from '../../ui/useNow.js'
import { Field } from '../../ui/Field.jsx'
import LessonForm from '../LessonForm.jsx'
import { byDateTime, formatDate, formatTime, isPast } from '../../rules.js'

// The admin schedules, moves and cancels every lesson.
export default function Lessons() {
  const { data, cancelAppointment } = useApp()
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const now = useNow()

  const [editing, setEditing] = useState(null) // the lesson being rescheduled
  const [query, setQuery] = useState('')

  const nameOf = (id) => data.customers.find((c) => c.id === id)?.name ?? 'Unknown customer'

  const upcoming = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.appointments
      .filter((a) => !isPast(a.date, a.time, now))
      .filter((a) => !q || (data.customers.find((c) => c.id === a.customerId)?.name ?? '').toLowerCase().includes(q))
      .sort(byDateTime)
  }, [data, now, query])

  const cancel = async (appt) => {
    const confirmed = await ask({
      title: 'Cancel this lesson?',
      message: `${nameOf(appt.customerId)}: ${formatDate(appt.date)}, ${formatTime(appt.time)} at ${appt.place}`,
      confirmLabel: 'Cancel lesson',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!confirmed) return
    const result = await cancelAppointment(appt.id)
    if (!result.ok) {
      toast(result.error, 'error')
      return
    }
    toast('Lesson cancelled.')
    if (editing?.id === appt.id) setEditing(null)
  }

  return (
    <div className="split">
      <section className="card">
        <h2>{editing ? 'Reschedule lesson' : 'Schedule a lesson'}</h2>

        {data.customers.length === 0 ? (
          <p className="empty">You need a customer first. <Link to="/admin/add">Add one.</Link></p>
        ) : (
          <LessonForm key={editing?.id ?? 'new'} customers={data.customers} editing={editing} onDone={() => setEditing(null)} />
        )}
      </section>

      <section className="card">
        <div className="toolbar">
          <h2>Upcoming lessons ({upcoming.length})</h2>
          <Field label="Customer">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
          </Field>
        </div>

        {upcoming.length === 0 && <p className="empty">{query ? 'No lessons match your search.' : 'No upcoming lessons. Schedule one using the form.'}</p>}
        {upcoming.length > 0 && (
          <table className="stack">
            <thead>
              <tr><th>Customer</th><th>Date</th><th>Time</th><th>Place</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {upcoming.map((a) => (
                <tr key={a.id} className={a.id === editing?.id ? 'editing' : ''}>
                  <td data-label="Customer">{nameOf(a.customerId)}</td>
                  <td data-label="Date">{formatDate(a.date)}</td>
                  <td data-label="Time">{formatTime(a.time)}</td>
                  <td data-label="Place">{a.place}</td>
                  <td className="row-actions">
                    <button type="button" className="ghost" onClick={() => setEditing(a)}>Reschedule</button>
                    <button type="button" className="ghost danger" onClick={() => cancel(a)}>Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {dialog}
    </div>
  )
}
