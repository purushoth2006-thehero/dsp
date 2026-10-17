import { Link } from 'react-router-dom'
import { useApp } from '../state/appContext.js'
import { useToast } from '../ui/toastContext.js'
import CustomerForm from './CustomerForm.jsx'
import { BRAND } from '../rules.js'

export default function Register() {
  const { register } = useApp()
  const toast = useToast()

  const onSubmit = (form) => {
    const result = register(form)
    if (result.ok) toast('Account created. Welcome!')
    return result
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1><span aria-hidden="true">🚗</span> {BRAND}</h1>
        <h2 className="center">Create your account</h2>
        <CustomerForm confirmPassword submitLabel="Create account" onSubmit={onSubmit} />
        <p className="auth-alt">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
