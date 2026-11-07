import { useEffect, useState } from 'react'
import { request } from '../../api.js'
import { BRAND, CLOSED_WEEKDAYS, PACKAGES, PLACES, TIME_SLOTS, formatTime } from '../../rules.js'

export const PHONE = '7373515196'
export const EMAIL = 'drivetomyschool@gmail.com'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>{BRAND}</h1>
        <ul className="lines">
          <li>Friendly, experienced trainers</li>
          <li>Pick your batch</li>
          <li>Book your classes online</li>
        </ul>
      </section>
      <section className="info-grid">
        <div className="card">
          <h2>Book online</h2>
          <ul className="lines">
            <li>Sign in at the Students Corner</li>
            <li>Book your own classes</li>
          </ul>
        </div>
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
          <ul className="lines">
            <li>One-to-one practical training on the road</li>
            <li>Experienced trainers</li>
            <li>Lady trainer available for one-to-one lessons</li>
          </ul>
        </div>
        <div className="card">
          <h2>Packages</h2>
          <ul className="lines">
            <li>Diamond: {PACKAGES.diamond.lessons} lessons</li>
            <li>Gold: {PACKAGES.gold.lessons} lessons</li>
          </ul>
        </div>
        <div className="card">
          <h2>Batches</h2>
          <ul className="lines">
            {TIME_SLOTS.map((t) => <li key={t}>{formatTime(t)}</li>)}
          </ul>
          <p className="muted">Closed on {CLOSED_WEEKDAYS.map((d) => DAYS[d]).join(' and ')}.</p>
        </div>
        <div className="card">
          <h2>Training places</h2>
          <ul className="lines">{PLACES.map((p) => <li key={p}>{p.replace(/_/g, ' ')}</li>)}</ul>
        </div>
        <div className="card">
          <h2>RTO services</h2>
          <ul className="lines">
            <li>Learner's licence (LL) application</li>
            <li>Driving licence test assistance</li>
            <li>Licence renewal</li>
            <li>Duplicate licence and address change</li>
            <li>International Driving Permit</li>
            <li>Vehicle RC transfer and renewal</li>
          </ul>
          <p className="muted">Call us for details and documents needed.</p>
        </div>
        <div className="card">
          <h2>Online booking</h2>
          <ul className="lines">
            <li>Sign in at the Students Corner</li>
            <li>Book, change or cancel your class</li>
            <li>Today or tomorrow only</li>
          </ul>
        </div>
      </section>
    </>
  )
}

// Offers are added and removed by the admin (Admin > Offers).
export function OffersPage() {
  const [offers, setOffers] = useState(null) // null while loading
  useEffect(() => {
    let live = true
    request('GET', '/api/offers').then((res) => { if (live) setOffers(res.ok ? res.data.offers : []) })
    return () => { live = false }
  }, [])
  return (
    <>
      <h1>Offers</h1>
      {offers && offers.length === 0 && <p className="muted">No offers right now. Please check again soon.</p>}
      <section className="info-grid">
        {(offers ?? []).map((o) => (
          <div className="card" key={o.id}>
            <h2>{o.title}</h2>
            {o.details && (
              <ul className="lines">{o.details.split(/\r?\n/).filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}</ul>
            )}
          </div>
        ))}
      </section>
    </>
  )
}

export function ContactPage() {
  return (
    <>
      <h1>Contact Us</h1>
      <section className="card contact">
        <ul className="lines">
          <li>Phone: <a href={`tel:+91${PHONE}`}>{PHONE}</a></li>
          <li>Email: <a href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
        </ul>
      </section>
    </>
  )
}
