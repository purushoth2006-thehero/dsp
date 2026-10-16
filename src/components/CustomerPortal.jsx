import { useMemo, useState } from 'react'
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
  }

  return (
    <main className="grid">
      <section className="card">
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