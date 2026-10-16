import { useMemo, useState } from 'react'
import { uid } from '../store.js'

export default function AdminPortal({ data, setData }) {
  const [tab, setTab] = useState('customers')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [msg, setMsg] = useState(null)
  const [filterDate, setFilterDate] = useState('')

  const rows = useMemo(
    () => data.customers.map((c) => {
      const appts = data.appointments.filter((a) => a.customerId === c.id)
      const present = appts.filter((a) => a.attendance === 'present').length
      const absent = appts.filter((a) => a.attendance === 'absent').length
      return { ...c, total: appts.length, present, absent }
    }),
    [data]
  )

  const addCustomer = (e) => {
    e.preventDefault()
    setMsg(null)
    if (data.customers.some((c) => c.email === form.email)) {
      setMsg({ ok: false, text: 'A customer with that email already exists.' })
      return
    }
    setData((d) => ({ ...d, customers: [...d.customers, { id: uid('c'), ...form }] }))
    setForm({ name: '', email: '', phone: '', password: '' })
    setMsg({ ok: true, text: 'Customer added.' })
  }

  const removeCustomer = (id) => {
    const c = data.customers.find((x) => x.id === id)
    if (!confirm(`Remove ${c.name}? Their appointments will be deleted too.`)) return
    setData((d) => ({
      customers: d.customers.filter((x) => x.id !== id),
      appointments: d.appointments.filter((a) => a.customerId !== id),
    }))
  }

  const setAttendance = (id, value) => {
    setData((d) => ({
      ...d,
      appointments: d.appointments.map((a) => (a.id === id ? { ...a, attendance: value } : a)),
    }))
  }

  const visible = data.appointments
    .filter((a) => !filterDate || a.date === filterDate)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <main>
      <div className="tabs wide">
        <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>Customers</button>
        <button className={tab === 'add' ? 'active' : ''} onClick={() => { setTab('add'); setMsg(null) }}>Add customer</button>
        <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance</button>
      </div>

      {tab === 'customers' && (
        <section className="card">
          <h2>Customers ({rows.length})</h2>
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Lessons</th><th>Present</th><th>Absent</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.total}</td>
                  <td><span className="badge present">{c.present}</span></td>
                  <td><span className="badge absent">{c.absent}</span></td>
                  <td><button className="ghost danger" onClick={() => removeCustomer(c.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'add' && (
        <section className="card narrow">
          <h2>Add customer</h2>
          <form className="form" onSubmit={addCustomer}>
            <label>Full name</label>
            <input value={form.name} onChange={set('name')} required />
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
            <label>Phone</label>
            <input value={form.phone} onChange={set('phone')} required />
            <label>Password</label>
            <input type="text" value={form.password} onChange={set('password')} required />
            {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
            <button className="primary" type="submit">Add customer</button>
          </form>
        </section>
      )}

      {tab === 'attendance' && (
        <section className="card">
          <div className="row">
            <h2>Attendance</h2>
            <label>Filter by date: <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /></label>
            {filterDate && <button className="ghost" onClick={() => setFilterDate('')}>Clear</button>}
          </div>
          {visible.length === 0 && <p className="empty">No appointments {filterDate && `on ${filterDate}`}. Try admin "Add customer" or a customer booking first.</p>}
          <table>
            <thead>
              <tr><th>Date</th><th>Time</th><th>Place</th><th>Customer</th><th>Mark attendance</th></tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const c = data.customers.find((x) => x.id === a.customerId)
                return (
                  <tr key={a.id}>
                    <td>{a.date}</td>
                    <td>{a.time}</td>
                    <td>{a.place}</td>
                    <td>{c ? c.name : <i>removed</i>}</td>
                    <td className="actions">
                      <button
                        className={`mark present ${a.attendance === 'present' ? 'on' : ''}`}
                        onClick={() => setAttendance(a.id, 'present')}
                      >Present</button>
                      <button
                        className={`mark absent ${a.attendance === 'absent' ? 'on' : ''}`}
                        onClick={() => setAttendance(a.id, 'absent')}
                      >Absent</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}