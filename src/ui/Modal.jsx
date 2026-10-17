import { useEffect, useId, useRef } from 'react'

// Accessible dialog: closes on Escape or a click outside, and returns focus when it closes.
export default function Modal({ title, onClose, children }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus()

    const onKey = (e) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && previous.focus) previous.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
