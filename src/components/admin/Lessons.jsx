import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/appContext.js'
import { useToast } from '../../ui/toastContext.js'
import useConfirm from '../../ui/useConfirm.jsx'
import useNow from '../../ui/useNow.js'
import { Field } from '../../ui/Field.jsx'
import {
  PLACES, TIME_SLOTS, byDateTime, formatDate, formatTime, getSlotConflict, isPast, toLocalDate,
} from '../../rules.js'

const SLOT_NOTE = { past: ' (passed)', booked: ' (booked)', mine: ' (customer has a lesson)' }

const emptyForm = () => ({ customerId: '', date: '', time: TIME_SLOTS[0], place: PLACES[0] })

// The admin schedules, moves and cancels every lesson.
export default function Lessons() {
  const { data, bookAppointment, rescheduleAppointment, cancelAppointment } = useApp()
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const now = useNow()

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null) // set while rescheduling
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const nameOf = (id) => data.customers.find((c) => c.id === id)?.name ?? 'Unknown customer'

  const upcoming = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.appointments
      .filter((a) => !isPast(a.date, a.time, now))
      .filter((a) => !q || (data.customers.find((c) => c.id === a.customerId)?.name ?? '').toLowerCase().includes(q))
      .sort(byDateTime)
  }, [data, now, query])

  // Which times can be picked for the chosen customer, date and place?
  const conflictFor = (time) => {
    if (!form.date) return null
    return getSlotConflict({ date: form.date, time, place: form.place }, data.appointments, {
      customerId: form.customerId || undefined, ignoreId: editingId, now,
    })
  }
  const isFree = (time) => !conflictFor(time)
  const time = isFree(form.time) ? form.time : (TIME_SLOTS.find(isFree) ?? form.time)
  const noSlots = Boolean(form.date) && !TIME_SLOTS.some(isFree)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
  }

  const startReschedule = (appt) => {
    setEditingId(appt.id)
    setForm({ customerId: appt.customerId, date: appt.date, time: appt.time, place: appt.place })
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.customerId) {
      setError('Please choose a customer.')
      return
    }
    const slot = { date: form.date, time, place: form.place }
    setBusy(true)
    const result = editingId
      ? await rescheduleAppointment(editingId, slot)
      : await bookAppointment(form.customerId, slot)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const when = `${formatDate(slot.date)}, ${formatTime(slot.time)}`
    toast(editingId
      ? `Moved ${nameOf(form.customerId)} to ${when}.`
      : `Scheduled ${nameOf(form.customerId)}: ${when} at ${slot.place}.`)
    resetForm()
  }

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
    if (editingId === appt.id) resetForm()
  }

  return (
    <div className="split">
      <section className="card">
        <h2>{editingId ? 'Reschedule lesson' : 'Schedule a lesson'}</h2>

        {data.customers.length === 0 ? (
          <p className="empty">You need a customer first. <Link to="/admin/add">Add one.</Link></p>
        ) : (
          <form onSubmit={submit} className="form">
            <Field label="Customer">
              <select value={form.customerId} onChange={set('customerId')} disabled={Boolean(editingId)} required>
                <option value="">Choose a customer…</option>
                {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Date">
              <input type="date" value={form.date} min={toLocalDate(now)} onChange={set('date')} required />
            </Field>

            <Field label="Place">
              <select value={form.place} onChange={set('place')}>
                {PLACES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>

            <Field label="Time">
              <select value={time} onChange={set('time')}>
                {TIME_SLOTS.map((t) => {
                  const conflict = conflictFor(t)
                  return (
                    <option key={t} value={t} disabled={Boolean(conflict)}>
                      {formatTime(t)}{conflict ? SLOT_NOTE[conflict.code] ?? '' : ''}
                    </option>
                  )
                })}
              </select>
            </Field>

            {noSlots && <p className="error">No free slots on this date at {form.place}. Try another day or branch.</p>}
            {error && <p className="error" role="alert">{error}</p>}

            <div className="form-actions">
              <button className="primary" type="submit" disabled={noSlots || busy}>
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Schedule lesson'}
              </button>
              {editingId && <button className="ghost" type="button" onClick={resetForm}>Cancel edit</button>}
            </div>
          </form>
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
                <tr key={a.id} className={a.id === editingId ? 'editing' : ''}>
                  <td data-label="Customer">{nameOf(a.customerId)}</td>
                  <td data-label="Date">{formatDate(a.date)}</td>
                  <td data-label="Time">{formatTime(a.time)}</td>
                  <td data-label="Place">{a.place}</td>
                  <td className="row-actions">
                    <button type="button" className="ghost" onClick={() => startReschedule(a)}>Reschedule</button>
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
