import useNow from '../ui/useNow.js'
import { BRAND, byDateTime, formatDate, formatTime, isPast, packageOf, trainerName } from '../rules.js'

// A bordered lesson-schedule table that only shows when printing (see the print rules in styles.css).
export default function ScheduleSheet({ customer, appointments }) {
  const now = useNow()
  const lessons = appointments.filter((a) => a.customerId === customer.id).sort(byDateTime)
  return (
    <section className="print-only">
      <h2>{BRAND}: lesson schedule</h2>
      <p>{customer.name}{customer.phone ? `, ${customer.phone}` : ''} · {packageOf(customer).label}</p>
      <table className="stack">
        <thead>
          <tr><th>No.</th><th>Date</th><th>Time</th><th>Place</th><th>Trainer</th><th>Attendance</th></tr>
        </thead>
        <tbody>
          {lessons.map((a, i) => (
            <tr key={a.id}>
              <td>{i + 1}</td>
              <td>{formatDate(a.date)}</td>
              <td>{formatTime(a.time)}</td>
              <td>{a.place}</td>
              <td>{trainerName(a.trainerId)}</td>
              <td>{a.attendance ?? (isPast(a.date, a.time, now) ? 'not marked' : 'upcoming')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
