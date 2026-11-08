import { useEffect, useRef, useState } from 'react'

const MAX = 85 // degrees of turn from the middle to full lock: a short turn of the wheel is enough

const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180

// A steering wheel you turn by dragging it. It springs back to the middle when you let go.
// onChange gets -1 (full left) .. 1 (full right), or null once the wheel is released.
export default function SteeringWheel({ onChange }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const [rot, setRot] = useState(0)
  const [held, setHeld] = useState(false)
  const rotNow = useRef(0) // the wheel's turn right now, so a new touch starts from where the wheel is

  // Where the finger is: the angle round the wheel, or null while it is too near the middle to tell.
  const pointerAngle = (e) => {
    const r = ref.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    if (Math.hypot(dx, dy) < r.width * 0.16) return null
    return (Math.atan2(dx, -dy) * 180) / Math.PI
  }
  const apply = (deg) => {
    const v = Math.max(-MAX, Math.min(MAX, deg))
    rotNow.current = v
    setRot(v)
    onChange(v / MAX)
  }
  // If the finger is lifted anywhere (even outside the wheel, or the touch is cancelled), the wheel must let go.
  useEffect(() => {
    const release = (e) => {
      // Only the finger that holds the wheel lets it go: another finger on Gas or Brake must not.
      if (!drag.current || (e.pointerId !== undefined && e.pointerId !== drag.current.id)) return
      drag.current = null
      setHeld(false)
      rotNow.current = 0
      setRot(0)
      onChange(null)
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    const blur = () => release({})
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', blur) }
  }, [onChange])
  const down = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* tracked without capture */ }
    drag.current = { id: e.pointerId, from: pointerAngle(e), base: rotNow.current }
    setHeld(true)
  }
  const move = (e) => {
    if (!drag.current || e.pointerId !== drag.current.id) return
    const a = pointerAngle(e)
    if (a === null) return // in the middle: keep the wheel where it is
    if (drag.current.from === null) drag.current.from = a // the touch began in the middle: turn from where the finger first leaves it
    apply(drag.current.base + wrap(a - drag.current.from))
  }
  const up = (e) => {
    if (!drag.current || e.pointerId !== drag.current.id) return
    drag.current = null
    setHeld(false)
    rotNow.current = 0
    setRot(0)
    onChange(null)
  }
  // Keyboard: arrow keys on a focused wheel nudge it (the game also reads the arrow keys directly).
  return (
    <div
      ref={ref}
      className={`wheel${held ? ' held' : ''}`}
      role="img"
      aria-label="Steering wheel: drag to turn"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="-100 -100 200 200" style={{ transform: `rotate(${rot}deg)` }}>
        <circle r="84" fill="none" stroke="#0a0c0e" strokeWidth="22" />
        <circle r="84" fill="none" stroke="#3a434b" strokeWidth="12" />
        <path d="M-84 0H84M0 0V84" stroke="#0a0c0e" strokeWidth="16" />
        <circle r="24" fill="#b91c22" />
        <circle r="9" fill="#fff" />
        <rect x="-4" y="-104" width="8" height="18" fill="#ffc400" />
      </svg>
    </div>
  )
}
