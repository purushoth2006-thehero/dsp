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
        <p>Learn to drive with friendly, experienced trainers. Pick your batch and book your classes online.</p>
      </section>
      <section className="info-grid">
        <div className="card"><h2>Book online</h2><p>Students sign in at the Students Corner (top right) and book their own classes.</p></div>
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
          <p>Lady trainer available for one-to-one lessons.</p>
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
          <h2>RTO services</h2>
          <ul>
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
          <p>Book, change or cancel your class for today or tomorrow after signing in at the Students Corner.</p>
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
            {o.details && <p>{o.details}</p>}
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
        <p><b>Phone:</b> <a href={`tel:+91${PHONE}`}>{PHONE}</a></p>
        <p><b>Email:</b> <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
      </section>
    </>
  )
}
