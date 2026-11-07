import { useCallback, useEffect, useState } from 'react'
import { request } from '../../api.js'
import { useToast } from '../../ui/toastContext.js'
import { Field } from '../../ui/Field.jsx'
import useConfirm from '../../ui/useConfirm.jsx'

// The admin adds and removes the offers shown on the public Offers page.
export default function AdminOffers() {
  const toast = useToast()
  const [ask, dialog] = useConfirm()
  const [offers, setOffers] = useState([])
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await request('GET', '/api/offers')
    if (res.ok) setOffers(res.data.offers)
  }, [])
  useEffect(() => {
    let live = true
    request('GET', '/api/offers').then((res) => { if (live && res.ok) setOffers(res.data.offers) })
    return () => { live = false }
  }, [])

  const add = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await request('POST', '/api/offers', { title, details })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setTitle('')
    setDetails('')
    toast('Offer added.')
    return load()
  }

  const remove = async (offer) => {
    if (!(await ask({ title: 'Remove offer', message: `Remove the offer "${offer.title}"?`, confirmLabel: 'Remove', danger: true }))) return
    const res = await request('DELETE', `/api/offers/${offer.id}`)
    if (!res.ok) return setError(res.error)
    toast('Offer removed.')
    return load()
  }

  return (
    <>
      <section className="card narrow">
        <h2>Add offer</h2>
        <form className="form" onSubmit={add}>
          <Field label="Offer title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          </Field>
          <Field label="Details (optional)">
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={300} rows={3} />
          </Field>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add offer'}</button>
        </form>
      </section>

      <section className="card">
        <h2>Current offers</h2>
        {offers.length === 0 && <p className="muted">No offers yet. The public Offers page is empty.</p>}
        <ul className="offer-list">
          {offers.map((o) => (
            <li key={o.id}>
              <div><b>{o.title}</b>{o.details && <p>{o.details}</p>}</div>
              <button type="button" className="ghost danger" onClick={() => remove(o)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
      {dialog}
    </>
  )
}
