import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/appContext.js'
import { Field, PasswordInput } from '../ui/Field.jsx'
import { BRAND, ROLES } from '../rules.js'

// Demo logins are shown only in development, or when VITE_SHOW_DEMO=true is set at build time.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true'

export default function Login() {
  const { loginAdmin, loginCustomer } = useApp()
  const [role, setRole] = useState(ROLES.CUSTOMER)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const switchRole = (next) => {
    setRole(next)
    setPassword('')
    setError('')
  }

  const submit = (e) => {
    e.preventDefault()
    setError('')
    const result = role === ROLES.ADMIN ? loginAdmin(username, password) : loginCustomer(username, password)
    if (!result.ok) setError(result.error)
  }

  const isAdmin = role === ROLES.ADMIN

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1><span aria-hidden="true">🚗</span> {BRAND}</h1>

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
          <button className="primary" type="submit">Sign in</button>
        </form>

        {!isAdmin && (
          <p className="auth-alt">
            New student? <Link to="/register">Create an account</Link>
          </p>
        )}

        {SHOW_DEMO && (
          <p className="hint">
            Demo admin: <b>admin / admin123</b><br />
            Demo customer: <b>alice@example.com / pass123</b>
          </p>
        )}
      </div>
    </main>
  )
}
