import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CAR, ROAD_HALF, SPEED_LIMIT, buildTrack, drivingScore, kmh, newRun, stepRun } from '../../drive.js'

const W = 420
const H = 560
const BEST_KEY = 'dsp-drive-best-lap'

const readBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 } }
const saveBest = (t) => { try { localStorage.setItem(BEST_KEY, String(t)) } catch { /* private mode: the best time is not kept */ } }
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

function drawCar(ctx, car) {
  ctx.save()
  ctx.translate(car.x, car.y)
  ctx.rotate(car.heading)
  const L = CAR.length
  const Wd = CAR.width
  ctx.fillStyle = 'rgba(0,0,0,.3)'
  ctx.beginPath(); ctx.roundRect(-Wd / 2 + 0.25, -L / 2 + 0.3, Wd, L, 0.5); ctx.fill()
  ctx.fillStyle = '#111' // wheels; the front pair turns with the steering
  const wheel = (x, y, angle) => { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillRect(-0.18, -0.45, 0.36, 0.9); ctx.restore() }
  const turn = car.steer * 0.5
  wheel(-Wd / 2, -L * 0.3, turn); wheel(Wd / 2, -L * 0.3, turn); wheel(-Wd / 2, L * 0.3, 0); wheel(Wd / 2, L * 0.3, 0)
  ctx.fillStyle = '#b91c22' // body
  ctx.beginPath(); ctx.roundRect(-Wd / 2, -L / 2, Wd, L, 0.55); ctx.fill()
  ctx.fillStyle = '#1a232c' // windscreen and rear window
  ctx.beginPath(); ctx.roundRect(-Wd / 2 + 0.2, -L * 0.2, Wd - 0.4, L * 0.17, 0.25); ctx.fill()
  ctx.beginPath(); ctx.roundRect(-Wd / 2 + 0.25, L * 0.17, Wd - 0.5, L * 0.12, 0.25); ctx.fill()
  ctx.fillStyle = '#d63a40' // roof
  ctx.beginPath(); ctx.roundRect(-Wd / 2 + 0.2, -L * 0.03, Wd - 0.4, L * 0.19, 0.2); ctx.fill()
  ctx.fillStyle = '#fff3b0' // headlights
  ctx.fillRect(-Wd / 2 + 0.12, -L / 2 + 0.05, 0.4, 0.2); ctx.fillRect(Wd / 2 - 0.52, -L / 2 + 0.05, 0.4, 0.2)
  ctx.fillStyle = car.braking ? '#ff2b2b' : '#7a1212' // brake lights
  ctx.fillRect(-Wd / 2 + 0.12, L / 2 - 0.25, 0.45, 0.18); ctx.fillRect(Wd / 2 - 0.57, L / 2 - 0.25, 0.45, 0.18)
  ctx.restore()
}

function draw(ctx, track, run, hud) {
  const { car } = run
  const scale = 8.5 - Math.min(Math.abs(car.v), 30) * 0.1 // zoom out a little at speed
  ctx.fillStyle = '#2d8a4e'
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(W / 2, H * 0.7)
  ctx.scale(scale, scale)
  ctx.rotate(-car.heading) // the world turns, so the car always points up the screen
  ctx.translate(-car.x, -car.y)

  ctx.fillStyle = '#1f6e3c'
  for (const b of track.bushes) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill() }

  const path = new Path2D()
  track.pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)))
  path.closePath()
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#fff'; ctx.lineWidth = ROAD_HALF * 2 + 0.7; ctx.stroke(path) // edge lines
  ctx.strokeStyle = '#2b3036'; ctx.lineWidth = ROAD_HALF * 2 - 0.1; ctx.stroke(path) // tarmac
  ctx.strokeStyle = '#ffc400'; ctx.lineWidth = 0.22; ctx.setLineDash([3, 3]); ctx.stroke(path); ctx.setLineDash([]) // centre line

  // start / finish line
  const a = track.pts[0]
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(track.start.heading)
  for (let i = 0; i < 9; i += 1) { ctx.fillStyle = i % 2 ? '#fff' : '#111'; ctx.fillRect(-ROAD_HALF + i, -0.5, 1, 1) }
  ctx.restore()

  track.cones.forEach((c, i) => {
    if (run.hit.includes(i)) return
    ctx.fillStyle = '#ff7a00'; ctx.beginPath(); ctx.arc(c.x, c.y, 0.45, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, 0.2, 0, Math.PI * 2); ctx.fill()
  })
  drawCar(ctx, car)
  ctx.restore()

  // mini map
  const mx = W - 96; const my = 10; const ms = 86
  const xs = track.pts.map((p) => p.x); const ys = track.pts.map((p) => p.y)
  const minX = Math.min(...xs); const minY = Math.min(...ys)
  const k = ms / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY)
  ctx.fillStyle = 'rgba(20,24,28,.55)'; ctx.fillRect(mx - 4, my - 4, ms + 8, ms + 8)
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath()
  track.pts.forEach((p, i) => (i ? ctx.lineTo(mx + (p.x - minX) * k, my + (p.y - minY) * k) : ctx.moveTo(mx + (p.x - minX) * k, my + (p.y - minY) * k)))
  ctx.closePath(); ctx.stroke()
  ctx.fillStyle = '#ffc400'; ctx.beginPath(); ctx.arc(mx + (car.x - minX) * k, my + (car.y - minY) * k, 3.5, 0, Math.PI * 2); ctx.fill()

  if (hud.offroad) { ctx.fillStyle = 'rgba(255,196,0,.95)'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Off the road: slow down and steer back', W / 2, H - 20) }
}

// A driving test: take the car once round the track, weave through the cones, stay on the road and keep to 60 km/h.
export default function CarGame() {
  const track = useMemo(() => buildTrack(), [])
  const canvasRef = useRef(null)
  const runRef = useRef(newRun(track))
  const keys = useRef(new Set())
  const touch = useRef({ left: false, right: false, gas: false, brake: false })
  const [phase, setPhase] = useState('ready') // ready | playing | done
  const [hud, setHud] = useState({ speed: 0, gear: 'N', time: 0, cones: 0, over: false, offroad: false })
  const [result, setResult] = useState(null)
  const [best, setBest] = useState(readBest)

  const start = useCallback(() => {
    runRef.current = newRun(track)
    setResult(null)
    setPhase('playing')
  }, [track])

  const readInput = () => {
    const k = keys.current
    const t = touch.current
    const left = k.has('ArrowLeft') || k.has('a') || t.left
    const right = k.has('ArrowRight') || k.has('d') || t.right
    return {
      throttle: k.has('ArrowUp') || k.has('w') || t.gas ? 1 : 0,
      brake: k.has('ArrowDown') || k.has('s') || k.has(' ') || t.brake ? 1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
    }
  }

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    const still = { offroad: false }
    if (phase !== 'playing') { draw(ctx, track, runRef.current, still); return undefined }
    let raf = 0
    let last = performance.now()
    let lastHud = 0
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const run = stepRun(runRef.current, track, readInput(), dt)
      runRef.current = run
      draw(ctx, track, run, { offroad: run.offroad })
      if (now - lastHud > 90) {
        lastHud = now
        setHud({
          speed: kmh(run.car.v), gear: run.car.v > 0.5 ? 'D' : run.car.v < -0.5 ? 'R' : 'N',
          time: run.time, cones: run.hit.length, over: Math.abs(run.car.v) > SPEED_LIMIT + 0.5,
        })
      }
      if (run.finished) {
        const score = drivingScore(run)
        setResult({ time: run.time, cones: run.hit.length, grass: run.offroadTime, speeding: run.speedingTime, score })
        setBest((b) => { const next = b === 0 ? run.time : Math.min(b, run.time); saveBest(next); return next })
        setPhase('done')
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, track])

  useEffect(() => {
    const drive = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'])
    const normal = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key)
    const down = (e) => {
      const key = normal(e)
      if (!drive.has(key)) { if (e.key === 'Enter' && phase !== 'playing' && !(e.target instanceof HTMLButtonElement)) start(); return }
      if (phase === 'playing') e.preventDefault()
      keys.current.add(key)
    }
    const up = (e) => keys.current.delete(normal(e))
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear) }
  }, [phase, start])

  // A pedal or arrow on the screen is "held" for as long as the finger stays on it.
  const hold = (name) => ({
    onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); touch.current[name] = true },
    onPointerUp: () => { touch.current[name] = false },
    onPointerCancel: () => { touch.current[name] = false },
    onContextMenu: (e) => e.preventDefault(),
  })

  return (
    <>
      <h1>Driving test</h1>
      <div className="game">
        <div className="drive-hud">
          <div className={`speedo${hud.over ? ' over' : ''}`}><b>{hud.speed}</b><span>km/h</span></div>
          <div className="gear" aria-label="Gear">{hud.gear}</div>
          <div className="limit" aria-label="Speed limit 60"><span>60</span></div>
          <div className="drive-stats"><b>{fmt(hud.time)}</b><span>Cones hit: {hud.cones}</span></div>
        </div>

        <div className="game-stage">
          <canvas ref={canvasRef} width={W} height={H} aria-label="Driving test track" />
          {phase !== 'playing' && (
            <div className="game-overlay">
              {phase === 'done' && result ? (
                <>
                  <h2>Test complete</h2>
                  <ul className="lines">
                    <li>Time: {fmt(result.time)}{best === result.time ? ' (best)' : ''}</li>
                    <li>Cones hit: {result.cones}</li>
                    <li>On the grass: {result.grass.toFixed(1)} s</li>
                    <li>Over 60 km/h: {result.speeding.toFixed(1)} s</li>
                  </ul>
                  <p className="score">Driving score: <b>{result.score}</b> / 100</p>
                </>
              ) : (
                <>
                  <h2>Take the car round the track</h2>
                  <ul className="lines">
                    <li>W / ↑ to accelerate, S / ↓ to brake and reverse</li>
                    <li>A / D or ← / → to steer</li>
                    <li>Weave through the cones, stay on the road</li>
                    <li>Keep to 60 km/h</li>
                  </ul>
                  {best > 0 && <p>Best time: {fmt(best)}</p>}
                </>
              )}
              <button type="button" className="primary" onClick={start}>{phase === 'done' ? 'Drive again' : 'Start engine'}</button>
            </div>
          )}
        </div>

        <div className="drive-pad">
          <div className="pad-steer">
            <button type="button" className="ghost" aria-label="Steer left" {...hold('left')}>◀</button>
            <button type="button" className="ghost" aria-label="Steer right" {...hold('right')}>▶</button>
          </div>
          <div className="pad-pedals">
            <button type="button" className="ghost brake" aria-label="Brake" {...hold('brake')}>Brake</button>
            <button type="button" className="ghost gas" aria-label="Accelerate" {...hold('gas')}>Gas</button>
          </div>
        </div>
      </div>
    </>
  )
}
