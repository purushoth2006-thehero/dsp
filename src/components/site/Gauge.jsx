// A round dial like the ones on a car dashboard: a needle over a scale, with the number in the middle.
const SWEEP = 270 // degrees from the lowest to the highest mark
const at = (f) => -SWEEP / 2 + f * SWEEP

const point = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [Math.cos(a) * r, Math.sin(a) * r]
}

export default function Gauge({ value, max, step, labelEvery = 1, redFrom = 1, text, unit, warn, label }) {
  const f = Math.max(0, Math.min(1, value / max))
  const marks = Math.round(max / step)
  const [rx, ry] = point(at(redFrom), 38)
  const [ex, ey] = point(at(1), 38)
  return (
    <svg className={`gauge${warn ? ' warn' : ''}`} viewBox="-50 -50 100 100" role="img" aria-label={`${label}: ${text} ${unit}`}>
      <circle r="49" fill="#0d1114" stroke="#46505a" strokeWidth="2" />
      {redFrom < 1 && <path d={`M${rx} ${ry} A38 38 0 ${(1 - redFrom) * SWEEP > 180 ? 1 : 0} 1 ${ex} ${ey}`} fill="none" stroke="#e23b30" strokeWidth="4" />}
      {Array.from({ length: marks + 1 }, (_, i) => {
        const [x1, y1] = point(at(i / marks), 41)
        const [x2, y2] = point(at(i / marks), i % labelEvery === 0 ? 33 : 36)
        const [tx, ty] = point(at(i / marks), 26)
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d8dee3" strokeWidth={i % labelEvery === 0 ? 1.6 : 0.9} />
            {i % labelEvery === 0 && <text x={tx} y={ty + 2.6} textAnchor="middle" fontSize="7" fill="#aeb8c0">{Math.round(i * step * (max > 20 ? 1 : 1))}</text>}
          </g>
        )
      })}
      <g style={{ transform: `rotate(${at(f)}deg)` }} className="needle">
        <line x1="0" y1="6" x2="0" y2="-36" stroke="#ff5a2b" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <circle r="4" fill="#2a3138" stroke="#ff5a2b" strokeWidth="1.5" />
      <text y="22" textAnchor="middle" fontSize="13" fontWeight="800" fill={warn ? '#ff5a4f' : '#fff'}>{text}</text>
      <text y="31" textAnchor="middle" fontSize="6" fill="#9aa5ae">{unit}</text>
    </svg>
  )
}
