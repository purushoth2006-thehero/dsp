import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toastContext.js'

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const push = useCallback((text, kind = 'ok') => {
    nextId.current += 1
    const id = nextId.current
    setToasts((list) => [...list, { id, text, kind }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastContext.Provider>
  )
}
