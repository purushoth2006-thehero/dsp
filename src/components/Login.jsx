import { useCallback, useEffect, useState } from 'react'
import { request } from '../api.js'
import { useApp } from '../state/appContext.js'
import { Field, PasswordInput } from '../ui/Field.jsx'
import { Link } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import { BRAND, ROLES } from '../rules.js'

export default function Login() {
  const { loginAdmin, loginCustomer, serverError } = useApp()
  const [captcha, setCaptcha] = useState(null) // { id, image }; null when the server does not ask for one
  const [captchaText, setCaptchaText] = useState('')

  const loadCaptcha = useCallback(async () => {
    const res = await request('GET', '/api/captcha')
    if (res.ok) { setCaptcha(res.data.id ? res.data : null); setCaptchaText('') }
  }, [])
  useEffect(() => {
    let live = true
    request('GET', '/api/captcha').then((res) => { if (live && res.ok && res.data.id) setCaptcha(res.data) })
    return () => { live = false }
  }, [])
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
      ? await loginAdmin(username, password, { captchaId: captcha?.id, captcha: captchaText })
      : await loginCustomer(username, password, { captchaId: captcha?.id, captcha: captchaText })
    setBusy(false)
    loadCaptcha() // a picture can be tried only once
    if (!result.ok) setError(result.error)
  }

  const isAdmin = role === ROLES.ADMIN

  return (
    <main className="login-wrap">
      <ThemeToggle className="ghost" />
      <div className="login-card">
        <p className="back-home"><Link to="/">← Back to home</Link></p>
        <h1><span aria-hidden="true">🚗</span> {BRAND}</h1>

        {serverError && <p className="banner" role="alert">{serverError}</p>}

        <div className="tabs" role="group" aria-label="Sign in as">
          <button type="button" className={!isAdmin ? 'active' : ''} aria-pressed={!isAdmin} onClick={() => switchRole(ROLES.CUSTOMER)}>
            Student
          </button>
          <button type="button" className={isAdmin ? 'active' : ''} aria-pressed={isAdmin} onClick={() => switchRole(ROLES.ADMIN)}>
            Admin
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          <Field label={isAdmin ? 'Username' : 'Mobile number'}>
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

          {captcha && (
            <Field label="Type the letters you see">
              <div className="captcha">
                <img src={captcha.image} alt="Captcha: distorted letters" width="160" height="50" />
                <button type="button" className="ghost" onClick={loadCaptcha} aria-label="New picture">↻</button>
              </div>
              <input value={captchaText} onChange={(e) => setCaptchaText(e.target.value.slice(0, 8))} autoComplete="off" autoCapitalize="characters" required />
            </Field>
          )}

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
