import { useMemo, useState } from 'react'
import { useApp } from '../state/appContext.js'
import { useToast } from '../ui/toastContext.js'
import useConfirm from '../ui/useConfirm.jsx'
import LessonForm from './LessonForm.jsx'
import ScheduleSheet from './ScheduleSheet.jsx'
import useNow from '../ui/useNow.js'
import {
  ATTENDANCE, MAX_UPCOMING_PER_CUSTOMER, byDateTime, formatDate, formatTime, isPast, lessonsFor, packageOf, trainerName,
} from '../rules.js'

// Customers book, move and cancel their own lessons and follow their progress.
export default function CustomerPortal() {
  const { data, session, cancelAppointment } = useApp()
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const [editing, setEditing] = useState(null)
  const now = useNow()
  const [view, setView] = useState('upcoming')

  const customer = data.customers.find((c) => c.id === session.id)

  const TOTAL_LESSONS = lessonsFor(customer)

  const mine = useMemo(
    () => data.appointments.filter((a) => a.customerId === session.id).sort(byDateTime),
    [data.appointments, session.id]
  )
  const upcoming = mine.filter((a) => !isPast(a.date, a.time, now))
  const past = mine.filter((a) => isPast(a.date, a.time, now)).reverse()

  const attended = mine.filter((a) => a.attendance === ATTENDANCE.PRESENT).length
  const missed = mine.filter((a) => a.attendance === ATTENDANCE.ABSENT).length
  const booked = mine.filter((a) => a.attendance !== ATTENDANCE.ABSENT).length
  const pending = upcoming.filter((a) => !a.attendance).length
  const full = booked >= TOTAL_LESSONS
  const atLimit = pending >= MAX_UPCOMING_PER_CUSTOMER
  const percent = Math.min(100, Math.round((attended / TOTAL_LESSONS) * 100))

  const cancel = async (appt) => {
    const confirmed = await ask({
      title: 'Cancel this lesson?',
      message: `${formatDate(appt.date)}, ${formatTime(appt.time)} at ${appt.place}`,
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
    <main className="page top">
      <div className="stack-col readable">
        <section className="card no-print">
          <h2>Hello, {customer?.name}</h2>
          <p className="muted">
            Book your lessons below. Your package is {packageOf(customer).label}; your course is {TOTAL_LESSONS} lessons, and your profile is removed
            automatically once you have attended all {TOTAL_LESSONS}.
          </p>
        </section>

        <section className="card no-print">
          <h2>{editing ? 'Change lesson time' : 'Book a lesson'}</h2>
          {full && !editing ? (
            <p className="notice">All {TOTAL_LESSONS} lessons of your course are booked. Nothing more to book.</p>
          ) : atLimit && !editing ? (
            <p className="notice">
              You have {MAX_UPCOMING_PER_CUSTOMER} upcoming lessons, which is the most you can book at once.
              Once you attend or cancel one, you can book another.
            </p>
          ) : (
            <LessonForm key={editing?.id ?? 'new'} customerId={session.id} editing={editing} onDone={() => setEditing(null)} />
          )}
          {editing && atLimit && <p className="muted">Pick a new time for this lesson.</p>}
        </section>

        <section className="card no-print">
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
          <p className="muted">{upcoming.length} upcoming · {missed} missed · {Math.max(0, TOTAL_LESSONS - booked)} still to book</p>
        </section>

        <section className="card no-print">
          <div className="row">
            <h2>My lessons</h2>
            <button type="button" className="ghost" onClick={() => window.print()} disabled={mine.length === 0}>Print schedule</button>
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
              {upcoming.length === 0 && <p className="empty">No upcoming lessons yet. Book one above.</p>}
              {upcoming.length > 0 && (
                <table className="stack">
                  <thead>
                    <tr><th>Date</th><th>Time</th><th>Place</th><th>Trainer</th><th><span className="visually-hidden">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {upcoming.map((a) => (
                      <tr key={a.id}>
                        <td data-label="Date">{formatDate(a.date)}</td>
                        <td data-label="Time">{formatTime(a.time)}</td>
                        <td data-label="Place">{a.place}</td>
                        <td data-label="Trainer">{trainerName(a.trainerId)}</td>
                        <td className="row-actions">
                          {a.attendance ? (
                            <span className={`badge ${a.attendance}`}>{a.attendance}</span>
                          ) : (
                            <>
                              <button type="button" className="ghost" onClick={() => setEditing(a)}>Change</button>
                              <button type="button" className="ghost danger" onClick={() => cancel(a)}>Cancel</button>
                            </>
                          )}
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
                    <tr><th>Date</th><th>Time</th><th>Place</th><th>Trainer</th><th>Attendance</th></tr>
                  </thead>
                  <tbody>
                    {past.map((a) => (
                      <tr key={a.id}>
                        <td data-label="Date">{formatDate(a.date)}</td>
                        <td data-label="Time">{formatTime(a.time)}</td>
                        <td data-label="Place">{a.place}</td>
                        <td data-label="Trainer">{trainerName(a.trainerId)}</td>
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
        {customer && <ScheduleSheet customer={customer} appointments={mine} />}
      </div>
      {dialog}
    </main>
  )
}
