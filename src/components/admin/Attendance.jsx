import { useMemo, useState } from 'react'
import { useApp } from '../../state/appContext.js'
import { useToast } from '../../ui/toastContext.js'
import { Field } from '../../ui/Field.jsx'
import useConfirm from '../../ui/useConfirm.jsx'
import { downloadTextFile } from '../../download.js'
import {
  ATTENDANCE, PLACES, TOTAL_LESSONS, byDateTime, formatDate, formatTime, normalizePhone, toCsv, toLocalDate, nowInZone,
} from '../../rules.js'

const COLUMNS = [
  { label: 'Date', value: (r) => formatDate(r.date), text: true },
  { label: 'Time', value: (r) => formatTime(r.time), text: true },
  { label: 'Place', value: (r) => r.place },
  { label: 'Customer', value: (r) => r.customer?.name ?? 'removed' },
  { label: 'Mobile', value: (r) => r.customer?.phone ?? '', text: true },
  { label: 'Attendance', value: (r) => r.attendance ?? 'not marked' },
]

export default function Attendance() {
  const { data, setAttendance } = useApp()
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const [filterDate, setFilterDate] = useState('')
  const [filterPlace, setFilterPlace] = useState('')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = normalizePhone(query)
    return data.appointments
      .map((a) => ({ ...a, customer: data.customers.find((c) => c.id === a.customerId) }))
      .filter((a) => !filterDate || a.date === filterDate)
      .filter((a) => !filterPlace || a.place === filterPlace)
      .filter((a) => !q
        || a.customer?.name.toLowerCase().includes(q)
        || (digits && a.customer?.phone.includes(digits)))
      .sort(byDateTime)
  }, [data, filterDate, filterPlace, query])

  const hasFilters = Boolean(filterDate || filterPlace || query)

  const clearFilters = () => {
    setFilterDate('')
    setFilterPlace('')
    setQuery('')
  }

  // Click the active button again to clear the mark.
  const toggle = async (appt, value) => {
    // Attending the last lesson of the course deletes the customer's profile, so ask first.
    if (value === ATTENDANCE.PRESENT && appt.attendance !== value && appt.customer) {
      const attended = data.appointments
        .filter((a) => a.customerId === appt.customerId && a.attendance === ATTENDANCE.PRESENT).length
      if (attended + 1 >= TOTAL_LESSONS) {
        const confirmed = await ask({
          title: `Finish ${appt.customer.name}'s course?`,
          message: `This is lesson ${TOTAL_LESSONS} of ${TOTAL_LESSONS}. Marking it present removes ${appt.customer.name}'s profile and all their lessons. This cannot be undone.`,
          confirmLabel: 'Mark present and remove',
          cancelLabel: 'Not yet',
          danger: true,
        })
        if (!confirmed) return
      }
    }
    const result = await setAttendance(appt.id, appt.attendance === value ? null : value)
    if (!result.ok) toast(result.error, 'error')
    else if (result.completed) toast(`${result.completed.name} finished all ${TOTAL_LESSONS} lessons. Their profile has been removed.`)
  }

  const exportCsv = () => {
    downloadTextFile(`attendance-${filterDate || toLocalDate(nowInZone())}.csv`, toCsv(rows, COLUMNS))
  }

  return (
    <section className="card">
      <div className="toolbar">
        <h2>Attendance ({rows.length})</h2>
        <Field label="Date">
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </Field>
        <Field label="Place">
          <select value={filterPlace} onChange={(e) => setFilterPlace(e.target.value)}>
            <option value="">All places</option>
            {PLACES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Customer">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or mobile" />
        </Field>
        {hasFilters && <button type="button" className="ghost" onClick={clearFilters}>Clear filters</button>}
        <button type="button" className="ghost" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>

      {rows.length === 0 && (
        <p className="empty">
          {data.appointments.length === 0
            ? 'No lessons scheduled yet. Use the Lessons page to schedule one.'
            : <>No lessons match these filters. <button type="button" className="link-button" onClick={clearFilters}>Clear filters</button></>}
        </p>
      )}

      {rows.length > 0 && (
        <table className="stack">
          <thead>
            <tr><th>Date</th><th>Time</th><th>Place</th><th>Customer</th><th>Mark attendance</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td data-label="Date">{formatDate(a.date)}</td>
                <td data-label="Time">{formatTime(a.time)}</td>
                <td data-label="Place">{a.place}</td>
                <td data-label="Customer">{a.customer ? a.customer.name : <i>removed</i>}</td>
                <td className="actions">
                  <button
                    type="button"
                    className={`mark present ${a.attendance === ATTENDANCE.PRESENT ? 'on' : ''}`}
                    aria-pressed={a.attendance === ATTENDANCE.PRESENT}
                    onClick={() => toggle(a, ATTENDANCE.PRESENT)}
                  >Present</button>
                  <button
                    type="button"
                    className={`mark absent ${a.attendance === ATTENDANCE.ABSENT ? 'on' : ''}`}
                    aria-pressed={a.attendance === ATTENDANCE.ABSENT}
                    onClick={() => toggle(a, ATTENDANCE.ABSENT)}
                  >Absent</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">Tip: click a highlighted button again to clear the mark. A customer's profile is removed automatically when their {TOTAL_LESSONS}th lesson is marked present.</p>
      {dialog}
    </section>
  )
}
