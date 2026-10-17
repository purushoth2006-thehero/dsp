import { cloneElement, useId, useState } from 'react'

// Label + control with a proper htmlFor/id link. The child must accept an `id` prop.
export function Field({ label, hint, children }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  )
}

export function PasswordInput({ id, value, onChange, autoComplete, required, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="ghost"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
