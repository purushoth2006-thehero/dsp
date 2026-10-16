import { useState } from 'react'

export default function Login({ data, onLogin }) {
  const [tab, setTab] = useState('customer')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (tab === 'admin') {
      if (username === data.admin.username && password === data.admin.password) {
        onLogin({ role: 'admin' })
      } else {
        setError('Invalid admin credentials')
      }
      return
    }
    const found = data.customers.find(
      (c) => (c.email === username || c.phone === username) && c.password === password
    )
    if (found) onLogin({ role: 'customer', id: found.id })
    else setError('Invalid email/phone or password')
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🚗 Sridhar Driving School</h1>
        <div className="tabs">
          <button className={tab === 'customer' ? 'active' : ''} onClick={() => { setTab('customer'); setError('') }}>
            Customer
          </button>
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => { setTab('admin'); setError('') }}>
            Admin
          </button>
        </div>

        <form onSubmit={submit}>
          <label>{tab === 'admin' ? 'Username' : 'Email or phone'}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={tab === 'admin' ? 'admin' : 'alice@example.com'}
            required
          />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Sign in</button>
        </form>

        <p className="hint">
          Demo admin: <b>admin / admin123</b><br />
          Demo customer: <b>alice@example.com / pass123</b>
        </p>
      </div>
    </div>
  )
}