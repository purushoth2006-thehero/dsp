import { useEffect, useState } from 'react'
import { useApp } from '../state/appContext.js'
import { useToast } from '../ui/toastContext.js'
import useNow from '../ui/useNow.js'
import { Field } from '../ui/Field.jsx'
import { fetchSlots } from '../api.js'
import { PLACES, TIME_SLOTS, formatDate, formatTime, getSlotConflict, toLocalDate } from '../rules.js'

const SLOT_NOTE = { past: ' (passed)', booked: ' (booked)', mine: ' (you already have a lesson)' }
const ADMIN_NOTE = { ...SLOT_NOTE, mine: ' (customer has a lesson)' }

// Book a new lesson, or move `editing`. The admin picks the customer; a customer books for themselves.
// Give it a `key` that changes with `editing` so the fields reset.
export default function LessonForm({ customers, customerId: fixedCustomerId, editing = null, onDone }) {
  const { data, bookAppointment, rescheduleAppointment } = useApp()
  const toast = useToast()
  const now = useNow()
  const isAdmin = Boolean(customers)

  const [form, setForm] = useState(() => (editing
    ? { customerId: editing.customerId, date: editing.date, time: editing.time, place: editing.place }
    : { customerId: fixedCustomerId ?? '', date: '', time: TIME_SLOTS[0], place: PLACES[0] }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [taken, setTaken] = useState({ date: '', slots: [] }) // other people's lessons on form.date (customers only)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // A customer can't see other people's lessons, so ask the server which times are taken that day.
  useEffect(() => {
    if (isAdmin || !form.date) return undefined
    let cancelled = false
    fetchSlots(form.date).then((res) => {
      if (!cancelled && res.ok) setTaken({ date: form.date, slots: res.data.slots ?? [] })
    })
    return () => { cancelled = true }
  }, [isAdmin, form.date, data.appointments])

  const others = !isAdmin && taken.date === form.date
    ? taken.slots.filter((s) => !s.mine).map((s, i) => ({ id: `other${i}`, customerId: 'other', date: form.date, ...s }))
    : []
  const checking = !isAdmin && Boolean(form.date) && taken.date !== form.date

  const conflictFor = (time) => {
    if (!form.date) return null
    return getSlotConflict({ date: form.date, time, place: form.place }, [...data.appointments, ...others], {
      customerId: form.customerId || undefined, ignoreId: editing?.id, now,
    })
  }
  const isFree = (time) => !conflictFor(time)
  const time = isFree(form.time) ? form.time : (TIME_SLOTS.find(isFree) ?? form.time)
  const noSlots = Boolean(form.date) && !checking && !TIME_SLOTS.some(isFree)

  const nameOf = (id) => data.customers.find((c) => c.id === id)?.name ?? 'the customer'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.customerId) {
      setError('Please choose a customer.')
      return
    }
    const slot = { date: form.date, time, place: form.place }
    setBusy(true)
    const result = editing
      ? await rescheduleAppointment(editing.id, slot)
      : await bookAppointment(form.customerId, slot)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const when = `${formatDate(slot.date)}, ${formatTime(slot.time)}`
    const who = isAdmin ? `${nameOf(form.customerId)}: ` : ''
    toast(editing ? `${who}moved to ${when}.` : `${who}lesson booked for ${when} at ${slot.place}.`)
    onDone?.()
    if (!editing) setForm((f) => ({ ...f, customerId: fixedCustomerId ?? '', date: '' }))
  }

  const notes = isAdmin ? ADMIN_NOTE : SLOT_NOTE

  return (
    <form onSubmit={submit} className="form">
      {isAdmin && (
        <Field label="Customer">
          <select value={form.customerId} onChange={set('customerId')} disabled={Boolean(editing)} required>
            <option value="">Choose a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}

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
                {formatTime(t)}{conflict ? notes[conflict.code] ?? '' : ''}
              </option>
            )
          })}
        </select>
      </Field>

      {checking && <p className="muted">Checking free times…</p>}
      {noSlots && <p className="error">No free slots on this date at {form.place}. Try another day or place.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="primary" type="submit" disabled={noSlots || checking || busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : isAdmin ? 'Schedule lesson' : 'Book lesson'}
        </button>
        {editing && <button className="ghost" type="button" onClick={onDone}>Cancel edit</button>}
      </div>
    </form>
  )
}
