import { useState } from 'react'
import { Field, PasswordInput } from '../ui/Field.jsx'
import { DEFAULT_CUSTOM_LESSONS, DEFAULT_PACKAGE, MAX_CUSTOM_LESSONS, MIN_PASSWORD, PACKAGES, packageId } from '../rules.js'

const EMPTY = { name: '', phone: '', password: '', package: DEFAULT_PACKAGE, lessons: DEFAULT_CUSTOM_LESSONS }

// Used by the admin to add and edit customers.
// onSubmit(form) may be async and must resolve to { ok, error }.
export default function CustomerForm({
  initial, requirePassword = true, packageLocked = false, submitLabel, onSubmit, onCancel, resetOnSuccess = false,
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await onSubmit(form)
    setBusy(false)
    if (!result.ok) setError(result.error)
    else if (resetOnSuccess) setForm(EMPTY)
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Full name">
        <input value={form.name} onChange={set('name')} autoComplete="off" required />
      </Field>
      <Field label="Mobile number" hint="10-digit Indian mobile number">
        <input type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} autoComplete="off" placeholder="9876543210" required />
      </Field>
      <Field
        label="Package"
        hint={packageLocked ? 'The package cannot be changed once lessons are booked.' : 'Diamond is 20 lessons, Gold is 10 lessons. Choose Custom to type any number of classes.'}
      >
        <select value={packageId(form.package)} onChange={set('package')} disabled={packageLocked}>
          {Object.values(PACKAGES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Field>
      {packageId(form.package) === 'custom' && (
        <Field label="Number of classes" hint={`Any number from 1 to ${MAX_CUSTOM_LESSONS}. The profile is removed after the last class.`}>
          <input type="number" inputMode="numeric" min="1" max={MAX_CUSTOM_LESSONS} step="1" value={form.lessons ?? ''} onChange={set('lessons')} required />
        </Field>
      )}
      <Field
        label={requirePassword ? 'Password' : 'New password'}
        hint={requirePassword
          ? `At least ${MIN_PASSWORD} characters. Give it to the student: they sign in with their mobile number and this password.`
          : 'Leave blank to keep the current password. Setting a new one signs the student out everywhere.'}
      >
        <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" required={requirePassword} />
      </Field>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button className="ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
