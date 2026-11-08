import { useEffect, useRef, useState } from 'react'

const MAX = 120 // degrees of turn from the middle to full lock

const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180

// A steering wheel you turn by dragging it. It springs back to the middle when you let go.
// onChange gets -1 (full left) .. 1 (full right), or null once the wheel is released.
export default function SteeringWheel({ onChange }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const [rot, setRot] = useState(0)
  const [held, setHeld] = useState(false)

  const pointerAngle = (e) => {
    const r = ref.current.getBoundingClientRect()
    return (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI
  }
  const apply = (deg) => {
    const v = Math.max(-MAX, Math.min(MAX, deg))
    setRot(v)
    onChange(v / MAX)
  }
  // If the finger is lifted anywhere (even outside the wheel, or the touch is cancelled), the wheel must let go.
  useEffect(() => {
    const release = () => {
      if (!drag.current) return
      drag.current = null
      setHeld(false)
      setRot(0)
      onChange(null)
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release) }
  }, [onChange])
  const down = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* tracked without capture */ }
    drag.current = { from: pointerAngle(e), base: rot }
    setHeld(true)
  }
  const move = (e) => {
    if (!drag.current) return
    apply(drag.current.base + wrap(pointerAngle(e) - drag.current.from))
  }
  const up = () => {
    if (!drag.current) return
    drag.current = null
    setHeld(false)
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
