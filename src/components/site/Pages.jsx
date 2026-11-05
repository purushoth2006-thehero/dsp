import { Link } from 'react-router-dom'
import { BRAND, CLOSED_WEEKDAYS, PACKAGES, PLACES, TIME_SLOTS, formatTime } from '../../rules.js'

export const PHONE = '7373515196'
export const EMAIL = 'drivetomyschool@gmail.com'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>{BRAND}</h1>
        <p>Learn to drive with patient, friendly training. Choose your package, pick your batch and book your classes online.</p>
        <div className="hero-actions">
          <Link to="/login" className="primary">Student Corner</Link>
          <a href={`tel:+91${PHONE}`} className="ghost">Call {PHONE}</a>
        </div>
      </section>
      <section className="info-grid">
        <div className="card"><h2>{PACKAGES.diamond.lessons} or {PACKAGES.gold.lessons} lessons</h2><p>Diamond: {PACKAGES.diamond.lessons} lessons. Gold: {PACKAGES.gold.lessons} lessons.</p></div>
        <div className="card"><h2>{TIME_SLOTS.length} batches a day</h2><p>{TIME_SLOTS.map(formatTime).join(', ')}.</p></div>
        <div className="card"><h2>Book online</h2><p>Students book their own classes in the Student Corner.</p></div>
      </section>
    </>
  )
}

export function ServicesPage() {
  return (
    <>
      <h1>Services</h1>
      <section className="info-grid">
        <div className="card">
          <h2>Driving lessons</h2>
          <p>One-to-one practical training on the road with an experienced trainer.</p>
        </div>
        <div className="card">
          <h2>Packages</h2>
          <ul>
            <li><b>Diamond</b>: {PACKAGES.diamond.lessons} lessons</li>
            <li><b>Gold</b>: {PACKAGES.gold.lessons} lessons</li>
          </ul>
        </div>
        <div className="card">
          <h2>Batches</h2>
          <p>{TIME_SLOTS.map(formatTime).join(', ')}.</p>
          <p className="muted">Closed on {CLOSED_WEEKDAYS.map((d) => DAYS[d]).join(' and ')}.</p>
        </div>
        <div className="card">
          <h2>Training places</h2>
          <ul>{PLACES.map((p) => <li key={p}>{p.replace(/_/g, ' ')}</li>)}</ul>
        </div>
        <div className="card">
          <h2>Online booking</h2>
          <p>Book, change or cancel your class for today or tomorrow in the <Link to="/login">Student Corner</Link>.</p>
        </div>
      </section>
    </>
  )
}

// Left empty on purpose; offers can be added here later.
export function OffersPage() {
  return (
    <>
      <h1>Offers</h1>
    </>
  )
}

export function ContactPage() {
  return (
    <>
      <h1>Contact Us</h1>
      <section className="card contact">
        <p><b>Phone:</b> <a href={`tel:+91${PHONE}`}>{PHONE}</a></p>
        <p><b>Email:</b> <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
      </section>
    </>
  )
}
