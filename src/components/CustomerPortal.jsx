import { useMemo, useState } from 'react'
import { useApp } from '../state/appContext.js'
import useNow from '../ui/useNow.js'
import {
  ATTENDANCE, TOTAL_LESSONS, byDateTime, formatDate, formatTime, isPast,
} from '../rules.js'

// Customers can see their lessons and progress. The school office does all scheduling.
export default function CustomerPortal() {
  const { data, session } = useApp()
  const now = useNow()
  const [view, setView] = useState('upcoming')

  const customer = data.customers.find((c) => c.id === session.id)

  const mine = useMemo(
    () => data.appointments.filter((a) => a.customerId === session.id).sort(byDateTime),
    [data.appointments, session.id]
  )
  const upcoming = mine.filter((a) => !isPast(a.date, a.time, now))
  const past = mine.filter((a) => isPast(a.date, a.time, now)).reverse()

  const attended = mine.filter((a) => a.attendance === ATTENDANCE.PRESENT).length
  const missed = mine.filter((a) => a.attendance === ATTENDANCE.ABSENT).length
  const percent = Math.min(100, Math.round((attended / TOTAL_LESSONS) * 100))

  return (
    <main className="page top">
      <div className="stack-col readable">
        <section className="card">
          <h2>Hello, {customer?.name}</h2>
          <p className="muted">
            Your lessons are scheduled by the school office. To book, change or cancel a lesson, please contact them.
          </p>
        </section>

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
            <h2>My lessons</h2>
            <div className="tabs compact" role="group" aria-label="Lesson list">
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
              {upcoming.length === 0 && <p className="empty">No upcoming lessons yet. The school office will schedule them.</p>}
              {upcoming.length > 0 && (
                <table className="stack">
                  <thead>
                    <tr><th>Date</th><th>Time</th><th>Place</th></tr>
                  </thead>
                  <tbody>
                    {upcoming.map((a) => (
                      <tr key={a.id}>
                        <td data-label="Date">{formatDate(a.date)}</td>
                        <td data-label="Time">{formatTime(a.time)}</td>
                        <td data-label="Place">{a.place}</td>
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
    </main>
  )
}
