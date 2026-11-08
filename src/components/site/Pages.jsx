import { useEffect, useState } from 'react'
import { request } from '../../api.js'
import { BRAND } from '../../rules.js'
import HeroSlides from './HeroSlides.jsx'

export const PHONE = '7373515196'
export const EMAIL = 'drivetomyschool@gmail.com'
const INSTAGRAM = { handle: 'sridhar_drivingschool', url: 'https://www.instagram.com/sridhar_drivingschool' }

// Edit these figures to match the school's real numbers.
const SINCE = 2013
const STUDENTS_TAUGHT = '10,000+'
const LICENCES_GOT = '7,000+'

export function HomePage() {
  return (
    <>
      <section className="hero">
        <HeroSlides />
        <div className="hero-head">
          <span className="l-plate" aria-hidden="true">L</span>
          <h1>{BRAND}</h1>
        </div>
        <ul className="signs">
          <li>Friendly, experienced trainers</li>
          <li>Pick your batch</li>
          <li>Book your classes online</li>
        </ul>
      </section>
      <section className="info-grid">
        <div className="card wide">
          <h2>About us</h2>
          <ul className="lines">
            <li>Teaching driving since {SINCE}</li>
            <li>{STUDENTS_TAUGHT} students taught to drive</li>
            <li>{LICENCES_GOT} students helped to get their driving licence</li>
            <li>Best driving school in Mahindra World City and the nearby areas</li>
          </ul>
        </div>
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
        <div className="card wide">
          <h2>Driving lessons</h2>
          <ul className="lines">
            <li>One-to-one practical training on the road</li>
            <li>Experienced trainers</li>
            <li>Lady trainer available for one-to-one lessons</li>
          </ul>
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
          <div className="card offer" key={o.id}>
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

// Social media pages of the school. Add another entry here to show another page.
export function SocialPage() {
  return (
    <>
      <h1>Social Media</h1>
      <section className="card social">
        <h2>Instagram</h2>
        <ul className="lines">
          <li>Follow our Instagram page</li>
          <li>@{INSTAGRAM.handle}</li>
        </ul>
        <a className="primary social-btn" href={INSTAGRAM.url} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          Open Instagram
        </a>
      </section>
    </>
  )
}
