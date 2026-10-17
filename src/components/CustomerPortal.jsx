import { useMemo, useState } from 'react'
<<<<<<< HEAD
import { useApp } from '../state/appContext.js'
import { useToast } from '../ui/toastContext.js'
import useConfirm from '../ui/useConfirm.jsx'
import useNow from '../ui/useNow.js'
import { Field } from '../ui/Field.jsx'
import {
  ATTENDANCE, PLACES, TIME_SLOTS, TOTAL_LESSONS,
  byDateTime, formatDate, formatTime, getSlotConflict, isPast, toLocalDate,
} from '../rules.js'

const emptyForm = () => ({ date: '', time: TIME_SLOTS[0], place: PLACES[0] })

const SLOT_NOTE = { past: ' (passed)', booked: ' (booked)', mine: ' (you have a lesson)' }

export default function CustomerPortal() {
  const { data, session, bookAppointment, rescheduleAppointment, cancelAppointment } = useApp()
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const now = useNow()

  const customer = data.customers.find((c) => c.id === session.id)

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null) // set while rescheduling
  const [error, setError] = useState('')
  const [view, setView] = useState('upcoming')

  const mine = useMemo(
    () => data.appointments.filter((a) => a.customerId === customer.id).sort(byDateTime),
    [data.appointments, customer.id]
  )
  const upcoming = mine.filter((a) => !isPast(a.date, a.time, now))
  const past = mine.filter((a) => isPast(a.date, a.time, now)).reverse()

  const attended = mine.filter((a) => a.attendance === ATTENDANCE.PRESENT).length
  const missed = mine.filter((a) => a.attendance === ATTENDANCE.ABSENT).length
  const percent = Math.min(100, Math.round((attended / TOTAL_LESSONS) * 100))

  // Which slots can be picked for the chosen date and place?
  const conflictFor = (time) => {
    if (!form.date) return null
    return getSlotConflict({ date: form.date, time, place: form.place }, data.appointments, {
      customerId: customer.id, ignoreId: editingId, now,
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
    setForm({ date: appt.date, time: appt.time, place: appt.place })
    setError('')
    setView('upcoming')
  }

  const submit = (e) => {
    e.preventDefault()
    setError('')
    const slot = { date: form.date, time, place: form.place }
    const result = editingId
      ? rescheduleAppointment(editingId, slot)
      : bookAppointment(customer.id, slot)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const when = `${formatDate(slot.date)}, ${formatTime(slot.time)}`
    toast(editingId ? `Rescheduled to ${when}.` : `Booked ${when} at ${slot.place}.`)
    resetForm()
  }

  const cancel = async (appt) => {
    const confirmed = await ask({
      title: 'Cancel this lesson?',
      message: `${formatDate(appt.date)}, ${formatTime(appt.time)} at ${appt.place}`,
      confirmLabel: 'Cancel lesson',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!confirmed) return
    const result = cancelAppointment(appt.id)
    if (!result.ok) {
      toast(result.error, 'error')
      return
    }
    toast('Lesson cancelled.')
    if (editingId === appt.id) resetForm()
=======
import { TIME_SLOTS, PLACES, uid } from '../store.js'

export default function CustomerPortal({ customer, appointments, update }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState(TIME_SLOTS[0])
  const [place, setPlace] = useState(PLACES[0])
  const [msg, setMsg] = useState(null)

  const mine = useMemo(
    () => appointments
      .filter((a) => a.customerId === customer.id)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [appointments, customer.id]
  )

  const book = (e) => {
    e.preventDefault()
    setMsg(null)
    if (date < new Date().toISOString().slice(0, 10)) {
      setMsg({ ok: false, text: 'Please choose today or a future date.' })
      return
    }
    const clash = appointments.some((a) => a.date === date && a.time === time && a.place === place)
    if (clash) {
      setMsg({ ok: false, text: `${place} is already booked at ${time} on ${date}. Pick another slot.` })
      return
    }
    update((d) => ({
      appointments: [...d.appointments, { id: uid('a'), customerId: customer.id, date, time, place, attendance: null }],
    }))
    setMsg({ ok: true, text: `Booked ${date} ${time} at ${place}.` })
  }

  const cancel = (id) => {
    if (!confirm('Cancel this appointment?')) return
    update((d) => ({ appointments: d.appointments.filter((a) => a.id !== id) }))
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd
  }

  return (
    <main className="grid">
      <section className="card">
<<<<<<< HEAD
        <h2>{editingId ? 'Reschedule lesson' : 'Book a lesson'}</h2>
        <form onSubmit={submit} className="form">
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
            <button className="primary" type="submit" disabled={noSlots}>
              {editingId ? 'Save changes' : 'Fix appointment'}
            </button>
            {editingId && <button className="ghost" type="button" onClick={resetForm}>Cancel edit</button>}
          </div>
        </form>
      </section>

      <div className="stack-col">
        <section className="card">
          <h2>My progress</h2>
          <p className="big">{attended} <span>of {TOTAL_LESSONS} lessons attended</span></p>
          <div
            className="bar"
            role="progressbar"
            aria-label="Lessons attended"
            aria-valuemin={0}
            aria-valuemax={TOTAL_LESSONS}
            aria-valuenow={Math.min(attended, TOTAL_LESSONS)}
          >
            <div style={{ width: `${percent}%` }} />
          </div>
          <p className="muted">{upcoming.length} upcoming · {missed} missed</p>
        </section>

        <section className="card">
          <div className="row">
            <h2>My appointments</h2>
            <div className="tabs compact" role="group" aria-label="Appointment list">
              <button type="button" className={view === 'upcoming' ? 'active' : ''} aria-pressed={view === 'upcoming'} onClick={() => setView('upcoming')}>
                Upcoming ({upcoming.length})
              </button>
              <button type="button" className={view === 'past' ? 'active' : ''} aria-pressed={view === 'past'} onClick={() => setView('past')}>
                Past ({past.length})
              </button>
            </div>
          </div>

          {view === 'upcoming' ? (
            <>
              {upcoming.length === 0 && <p className="empty">No upcoming lessons. Book one using the form.</p>}
              {upcoming.length > 0 && (
                <table className="stack">
                  <thead>
                    <tr><th>Date</th><th>Time</th><th>Place</th><th><span className="visually-hidden">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {upcoming.map((a) => (
                      <tr key={a.id} className={a.id === editingId ? 'editing' : ''}>
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
            </>
          ) : (
            <>
              {past.length === 0 && <p className="empty">No past lessons yet.</p>}
              {past.length > 0 && (
                <table className="stack">
                  <thead>
                    <tr><th>Date</th><th>Time</th><th>Place</th><th>Attendance</th></tr>
                  </thead>
                  <tbody>
                    {past.map((a) => (
                      <tr key={a.id}>
                        <td data-label="Date">{formatDate(a.date)}</td>
                        <td data-label="Time">{formatTime(a.time)}</td>
                        <td data-label="Place">{a.place}</td>
                        <td data-label="Attendance">
                          {a.attendance
                            ? <span className={`badge ${a.attendance}`}>{a.attendance}</span>
                            : <span className="badge none">not marked</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      </div>
      {dialog}
    </main>
  )
}
=======
        <h2>Book a lesson</h2>
        <form onSubmit={book} className="form">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <label>Time</label>
          <select value={time} onChange={(e) => setTime(e.target.value)}>
            {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
          </select>

          <label>Place</label>
          <select value={place} onChange={(e) => setPlace(e.target.value)}>
            {PLACES.map((p) => <option key={p}>{p}</option>)}
          </select>

          {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
          <button className="primary" type="submit">Fix appointment</button>
        </form>
      </section>

      <section className="card">
        <h2>My appointments</h2>
        {mine.length === 0 && <p className="empty">No appointments yet.</p>}
        <table>
          <thead>
            <tr><th>Date</th><th>Time</th><th>Place</th><th>Attendance</th><th /></tr>
          </thead>
          <tbody>
            {mine.map((a) => (
              <tr key={a.id}>
                <td>{a.date}</td>
                <td>{a.time}</td>
                <td>{a.place}</td>
                <td>{a.attendance ? <span className={`badge ${a.attendance}`}>{a.attendance}</span> : '—'}</td>
                <td><button className="ghost danger" onClick={() => cancel(a.id)}>Cancel</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd
