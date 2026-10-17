import { useState } from 'react'
import { useApp } from '../state/appContext.js'
import { Field, PasswordInput } from '../ui/Field.jsx'
import { BRAND, ROLES } from '../rules.js'

export default function Login() {
  const { loginAdmin, loginCustomer, serverError } = useApp()
  const [role, setRole] = useState(ROLES.CUSTOMER)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const switchRole = (next) => {
    setRole(next)
    setPassword('')
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = role === ROLES.ADMIN
      ? await loginAdmin(username, password)
      : await loginCustomer(username, password)
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  const isAdmin = role === ROLES.ADMIN

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1><span aria-hidden="true">🚗</span> {BRAND}</h1>

        {serverError && <p className="banner" role="alert">{serverError}</p>}

        <div className="tabs" role="group" aria-label="Sign in as">
          <button type="button" className={!isAdmin ? 'active' : ''} aria-pressed={!isAdmin} onClick={() => switchRole(ROLES.CUSTOMER)}>
            Customer
          </button>
          <button type="button" className={isAdmin ? 'active' : ''} aria-pressed={isAdmin} onClick={() => switchRole(ROLES.ADMIN)}>
            Admin
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          <Field label={isAdmin ? 'Username' : 'Email or mobile number'}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>

          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        {!isAdmin && (
          <p className="hint">Your login is created by the school office. Please contact them if you need one.</p>
        )}
      </div>
    </main>
  )
}
