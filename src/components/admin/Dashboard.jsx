import { Link } from 'react-router-dom'
import { useApp } from '../../state/appContext.js'
import useNow from '../../ui/useNow.js'
import { PLACES, computeStats, trainerName, formatDate, formatTime, toLocalDate } from '../../rules.js'

function Stat({ label, value, sub, warn }) {
  return (
    <div className={`card stat${warn ? ' warn' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { data } = useApp()
  const now = useNow()
  const s = computeStats(data, now)
  const maxCount = Math.max(1, ...s.byPlace.map((p) => p.count))

  return (
    <>
      <div className="stats">
        <Stat label="Customers" value={s.customers} />
        <Stat label="Lessons today" value={s.today} />
        <Stat label="Upcoming lessons" value={s.upcoming} />
        <Stat
          label="Attendance rate"
          value={s.rate === null ? '—' : `${s.rate}%`}
          sub={`${s.present} present · ${s.absent} absent`}
        />
        <Stat label="Attendance to mark" value={s.unmarked} sub="past lessons" warn={s.unmarked > 0} />
      </div>

      <section className="card">
        <h2>Upcoming days <span className="muted">· {s.byDay.length} day{s.byDay.length === 1 ? '' : 's'}, {s.upcoming} lesson{s.upcoming === 1 ? '' : 's'}</span></h2>
        {s.byDay.length === 0 ? <p className="empty">No upcoming lessons.</p> : (
          <table className="stack">
            <thead>
              <tr><th>Date</th><th>Lessons</th>{PLACES.map((p) => <th key={p}>{p}</th>)}</tr>
            </thead>
            <tbody>
              {s.byDay.map((d) => (
                <tr key={d.date}>
                  <td data-label="Date">{formatDate(d.date)}{d.date === toLocalDate(now) ? ' (today)' : ''}</td>
                  <td data-label="Lessons"><b>{d.count}</b></td>
                  {d.byPlace.map((p) => <td key={p.place} data-label={p.place}>{p.count || '–'}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th>Total</th><th>{s.upcoming}</th>{s.byPlace.map((p) => <th key={p.place}>{p.count}</th>)}</tr>
            </tfoot>
          </table>
        )}
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Today's lessons <span className="muted">· {formatDate(toLocalDate(now))}</span></h2>
          {s.todayList.length === 0 && <p className="empty">No lessons scheduled for today.</p>}
          {s.todayList.length > 0 && (
            <table className="stack">
              <thead>
                <tr><th>Time</th><th>Place</th><th>Trainer</th><th>Customer</th><th>Attendance</th></tr>
              </thead>
              <tbody>
                {s.todayList.map((a) => {
                  const c = data.customers.find((x) => x.id === a.customerId)
                  return (
                    <tr key={a.id}>
                      <td data-label="Time">{formatTime(a.time)}</td>
                      <td data-label="Place">{a.place}</td>
                      <td data-label="Trainer">{trainerName(a.trainerId)}</td>
                      <td data-label="Customer">{c ? c.name : <i>removed</i>}</td>
                      <td data-label="Attendance">
                        {a.attendance
                          ? <span className={`badge ${a.attendance}`}>{a.attendance}</span>
                          : <span className="badge none">not marked</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {s.unmarked > 0 && (
            <p className="muted">
              {s.unmarked} past lesson{s.unmarked === 1 ? '' : 's'} still need attendance. <Link to="/admin/attendance">Mark attendance</Link>
            </p>
          )}
        </section>

        <section className="card">
          <h2>Upcoming by branch</h2>
          <ul className="place-list">
            {s.byPlace.map((p) => (
              <li key={p.place}>
                <span>{p.place}</span>
                <b>{p.count}</b>
                <div className="bar" aria-hidden="true"><div style={{ width: `${(p.count / maxCount) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
