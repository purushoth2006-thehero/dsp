// A gear lever in the usual H pattern: 1 3 5 along the top, 2 4 R along the bottom, neutral in the middle.
// A finger on a position moves the lever there at once, so it works while the other hand holds the wheel.
const SLOTS = [
  { label: '1', gear: 1, cls: 'a' }, { label: '3', gear: 3, cls: 'b' }, { label: '5', gear: 5, cls: 'c' },
  { label: 'N', gear: 0, cls: 'n' },
  { label: '2', gear: 2, cls: 'd' }, { label: '4', gear: 4, cls: 'e' }, { label: 'R', gear: -1, cls: 'f' },
]

export default function GearShifter({ gear, onPick }) {
  return (
    <div className="gear-h" role="group" aria-label="Gear lever">
      {SLOTS.map((s) => (
        <button
          key={s.label}
          type="button"
          className={`slot ${s.cls}${gear === s.gear ? ' on' : ''}${s.gear === -1 ? ' rev' : ''}`}
          aria-label={s.gear === 0 ? 'Neutral' : s.gear < 0 ? 'Reverse' : `Gear ${s.gear}`}
          aria-pressed={gear === s.gear}
          onPointerDown={(e) => { e.preventDefault(); onPick(s.gear) }}
          onClick={(e) => { if (e.detail === 0) onPick(s.gear) }}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
