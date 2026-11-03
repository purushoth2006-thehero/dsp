import { useEffect, useState } from 'react'
import { useApp } from '../state/appContext.js'
import { useToast } from '../ui/toastContext.js'
import useNow from '../ui/useNow.js'
import { Field } from '../ui/Field.jsx'
import { fetchSlots } from '../api.js'
import { TIME_SLOTS, addDays, closedDayName, formatDate, formatTime, getSlotConflict, placeList, toLocalDate } from '../rules.js'

const SLOT_NOTE = { closed: ' (closed)', past: ' (passed)', booked: ' (booked)', mine: ' (you already have a lesson)' }
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
    : { customerId: fixedCustomerId ?? '', date: '', time: TIME_SLOTS[0], place: '' }))
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
  // A customer can have only one lesson a day (the admin has no such limit).
  const hasLessonThatDay = !isAdmin && Boolean(form.date)
    && data.appointments.some((a) => a.customerId === form.customerId && a.id !== editing?.id && a.date === form.date)
  const noSlots = Boolean(form.date) && !checking && !TIME_SLOTS.some(isFree)

  const nameOf = (id) => data.customers.find((c) => c.id === id)?.name ?? 'the customer'

  const today = toLocalDate(now)
  const days = [
    { key: 'today', label: 'Today', date: today },
    { key: 'tomorrow', label: 'Tomorrow', date: addDays(1, now) },
  ]
  const otherDay = Boolean(form.date) && !days.some((d) => d.date === form.date)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.customerId) {
      setError('Please choose a customer.')
      return
    }
    const slot = { date: form.date, time, place: form.place.trim() }
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

      <div className="field" role="group" aria-label="Day">
        <span className="field-label">Day</span>
        <div className="tabs compact-row">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              className={form.date === d.date ? 'active' : ''}
              aria-pressed={form.date === d.date}
              onClick={() => setForm((f) => ({ ...f, date: d.date }))}
            >
              {d.label}{closedDayName(d.date) ? ' (closed)' : ''}
              <small>{formatDate(d.date)}</small>
            </button>
          ))}
          {isAdmin && (
            <button type="button" className={otherDay ? 'active' : ''} aria-pressed={otherDay} onClick={() => setForm((f) => ({ ...f, date: otherDay ? f.date : addDays(2, now) }))}>
              Another day
            </button>
          )}
        </div>
        {isAdmin && otherDay && (
          <input type="date" aria-label="Date" value={form.date} min={toLocalDate(now)} onChange={set('date')} required />
        )}
      </div>

      <Field label="Place" hint="Type the place, or pick one from the list.">
        <input list="lesson-places" value={form.place} onChange={set('place')} maxLength={40} autoComplete="off" placeholder="e.g. Potheri" required />
      </Field>
      <datalist id="lesson-places">
        {placeList(data.appointments).map((p) => <option key={p} value={p} />)}
      </datalist>

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

      {hasLessonThatDay && <p className="error">You already have a lesson on this day. Only one lesson per day can be booked.</p>}
      {checking && <p className="muted">Checking free times…</p>}
      {closedDayName(form.date) && <p className="error">The school is closed on {closedDayName(form.date)}s. Please choose another day.</p>}
      {noSlots && !hasLessonThatDay && !closedDayName(form.date) && <p className="error">No free slots on this day at {form.place || 'this place'}. Try another day or place.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="primary" type="submit" disabled={hasLessonThatDay || noSlots || checking || busy || !form.date || !form.place.trim()}>
          {busy ? 'Saving…' : editing ? 'Save changes' : isAdmin ? 'Schedule lesson' : 'Book lesson'}
        </button>
        {editing && <button className="ghost" type="button" onClick={onDone}>Cancel edit</button>}
      </div>
    </form>
  )
}
