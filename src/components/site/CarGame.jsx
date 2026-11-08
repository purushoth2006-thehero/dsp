import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SPEED_LIMIT, WEATHER, buildLot, buildTrack, drivingScore, kmh, newParkingRun, newRun, parkingScore, stepParking, stepRun,
} from '../../drive.js'
import { VIEWS, VIEW_LABEL } from '../../camera.js'
import { draw3D, drawTop } from '../../render.js'
import SteeringWheel from './SteeringWheel.jsx'

const BEST_KEY = 'dsp-drive-best'

// On a phone the game takes the whole screen, so the road and the controls are both in view and the page cannot scroll.
const SMALL = '(max-width: 820px), (pointer: coarse)'

const MODES = {
  test: { label: 'Driving test', hint: 'One lap, cones, 60 km/h limit', view: 'chase' },
  free: { label: 'Free drive', hint: 'No rules: just practise', view: 'chase' },
  park: { label: 'Reverse parking', hint: 'Back into the green bay', view: 'top' },
}

const readBest = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {} } catch { return {} } }
const saveBest = (b) => { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)) } catch { /* private mode: the best is not kept */ } }
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

export default function CarGame() {
  const track = useMemo(() => buildTrack(), [])
  const lot = useMemo(() => buildLot(), [])
  const [mode, setMode] = useState('test')
  const [weather, setWeather] = useState('clear')
  const [view, setView] = useState(MODES.test.view)
  const scene = useMemo(() => (mode === 'park' ? { kind: 'lot', lot } : { kind: 'track', track }), [mode, lot, track])
  const canvasRef = useRef(null)
  const runRef = useRef(newRun(track))
  const keys = useRef(new Set())
  const touch = useRef({ gas: false, brake: false, wheel: null })
  const [phase, setPhase] = useState('ready') // ready | playing | done
  const [hud, setHud] = useState({ speed: 0, gear: 'N', time: 0, count: 0, over: false })
  const [result, setResult] = useState(null)
  const [best, setBest] = useState(readBest)
  const stageRef = useRef(null)
  const [size, setSize] = useState({ w: 420, h: 560 })
  const [small, setSmall] = useState(() => window.matchMedia(SMALL).matches)
  const full = small && phase !== 'ready'

  const pickMode = (m) => {
    setMode(m)
    setView(MODES[m].view)
    runRef.current = m === 'park' ? newParkingRun(lot) : newRun(track)
  }

  useEffect(() => {
    const mq = window.matchMedia(SMALL)
    const on = () => setSmall(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Lock the page behind the full-screen game so touching the controls never scrolls it.
  useEffect(() => {
    if (!full) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [full])

  // The canvas is as big as its box on screen, so it is sharp and never stretched.
  useEffect(() => {
    const el = stageRef.current
    const measure = () => setSize({ w: Math.max(200, Math.round(el.clientWidth)), h: Math.max(240, Math.round(el.clientHeight)) })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const start = useCallback(() => {
    runRef.current = mode === 'park' ? newParkingRun(lot) : newRun(track)
    touch.current = { gas: false, brake: false, wheel: null }
    setResult(null)
    setHud({ speed: 0, gear: 'N', time: 0, count: 0, over: false })
    setPhase('playing')
  }, [mode, lot, track])

  const toMenu = () => {
    runRef.current = mode === 'park' ? newParkingRun(lot) : newRun(track)
    setPhase('ready')
  }

  const cycleView = useCallback(() => setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]), [])

  const readInput = () => {
    const k = keys.current
    const t = touch.current
    const key = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0)
    return {
      throttle: k.has('ArrowUp') || k.has('w') || t.gas ? 1 : 0,
      brake: k.has('ArrowDown') || k.has('s') || k.has(' ') || t.brake ? 1 : 0,
      steer: key !== 0 ? key : (t.wheel ?? 0),
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const { w, h } = size
    const paint = (run, time) => {
      const o = { view, weather, W: w, H: h, time, offroad: Boolean(run.offroad), wheel: !small }
      if (view === 'top') drawTop(ctx, scene, run, o)
      else draw3D(ctx, scene, run, o)
    }
    if (phase !== 'playing') { paint(runRef.current, 0); return undefined }
    let raf = 0
    let last = performance.now()
    let lastHud = 0
    const park = mode === 'park'
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const inp = readInput()
      const run = park
        ? stepParking(runRef.current, lot, inp, dt)
        : stepRun(runRef.current, track, inp, dt, { grip: WEATHER[weather].grip, free: mode === 'free' })
      runRef.current = run
      paint(run, now / 1000)
      if (now - lastHud > 90) {
        lastHud = now
        setHud({
          speed: kmh(run.car.v), gear: run.car.v > 0.5 ? 'D' : run.car.v < -0.5 ? 'R' : 'N',
          time: run.time, count: park ? run.hits : run.hit.length, over: mode === 'test' && Math.abs(run.car.v) > SPEED_LIMIT + 0.5,
        })
      }
      if (run.finished) {
        if (park) {
          const score = parkingScore(run)
          setResult({ time: run.time, hits: run.hits, score })
          setBest((b) => { const next = { ...b, park: Math.max(b.park ?? 0, score) }; saveBest(next); return next })
        } else {
          setResult({ time: run.time, cones: run.hit.length, grass: run.offroadTime, speeding: run.speedingTime, score: drivingScore(run) })
          setBest((b) => { const next = { ...b, test: b.test ? Math.min(b.test, run.time) : run.time }; saveBest(next); return next })
        }
        setPhase('done')
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, size, view, weather, mode, scene, track, lot, small])

  useEffect(() => {
    const drive = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'])
    const normal = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key)
    const down = (e) => {
      const key = normal(e)
      if (key === 'c' && !e.repeat) { cycleView(); return }
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
  }, [phase, start, cycleView])

  // A pedal on the screen is "held" for as long as the finger stays on it.
  const hold = (name) => ({
    onPointerDown: (e) => {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* the finger is tracked without capture */ }
      touch.current[name] = true
    },
    onPointerUp: () => { touch.current[name] = false },
    onPointerCancel: () => { touch.current[name] = false },
    onContextMenu: (e) => e.preventDefault(),
  })

  const m = MODES[mode]
  const bestLine = mode === 'test' && best.test ? `Best time: ${fmt(best.test)}` : mode === 'park' && best.park ? `Best score: ${best.park} / 100` : ''

  return (
    <>
      <h1>Driving practice</h1>
      <div className={`game${full ? ' full' : ''}`}>
        <div className="drive-hud">
          <div className={`speedo${hud.over ? ' over' : ''}`}><b>{hud.speed}</b><span>km/h</span></div>
          <div className="gear" aria-label="Gear">{hud.gear}</div>
          {mode === 'test' && <div className="limit" aria-label="Speed limit 60"><span>60</span></div>}
          <div className="drive-stats">
            <b>{fmt(hud.time)}</b>
            <span>{mode === 'park' ? `Bumps: ${hud.count}` : mode === 'test' ? `Cones hit: ${hud.count}` : 'Free drive'}</span>
          </div>
          {phase === 'playing' && <button type="button" className="exit" aria-label="Back to the menu" onClick={toMenu}>✕</button>}
        </div>

        <div className="game-stage" ref={stageRef}>
          <canvas ref={canvasRef} aria-label={`${m.label}, ${VIEW_LABEL[view]}`} />
          {phase !== 'ready' && (
            <button type="button" className="view-btn" onClick={cycleView} aria-label={`Camera: ${VIEW_LABEL[view]}. Change camera`}>
              📷 {VIEW_LABEL[view]}
            </button>
          )}
          {phase === 'ready' && (
            <div className="game-overlay menu">
              <h2>Choose a drive</h2>
              <div className="choice" role="group" aria-label="Drive">
                {Object.entries(MODES).map(([key, v]) => (
                  <button key={key} type="button" className={`opt${mode === key ? ' on' : ''}`} aria-pressed={mode === key} onClick={() => pickMode(key)}>
                    <b>{v.label}</b><span>{v.hint}</span>
                  </button>
                ))}
              </div>
              <div className="choice row" role="group" aria-label="Weather">
                {Object.entries(WEATHER).map(([key, v]) => (
                  <button key={key} type="button" className={`opt small${weather === key ? ' on' : ''}`} aria-pressed={weather === key} onClick={() => setWeather(key)}>{v.label}</button>
                ))}
              </div>
              <div className="choice row" role="group" aria-label="Camera">
                {VIEWS.map((v) => (
                  <button key={v} type="button" className={`opt small${view === v ? ' on' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
                ))}
              </div>
              <ul className="lines">
                <li>Drag the wheel to steer, hold Gas to go</li>
                <li>Brake stops the car, then reverses</li>
                <li>Keyboard: W A S D or arrows, C changes camera</li>
              </ul>
              {bestLine && <p>{bestLine}</p>}
              <button type="button" className="primary" onClick={start}>Start engine</button>
            </div>
          )}
          {phase === 'done' && result && (
            <div className="game-overlay">
              <h2>{mode === 'park' ? 'Parked!' : 'Test complete'}</h2>
              <ul className="lines">
                <li>Time: {fmt(result.time)}{mode === 'test' && best.test === result.time ? ' (best)' : ''}</li>
                {mode === 'park' ? <li>Bumps: {result.hits}</li> : (
                  <>
                    <li>Cones hit: {result.cones}</li>
                    <li>On the grass: {result.grass.toFixed(1)} s</li>
                    <li>Over 60 km/h: {result.speeding.toFixed(1)} s</li>
                  </>
                )}
              </ul>
              <p className="score">Driving score: <b>{result.score}</b> / 100</p>
              <button type="button" className="primary" onClick={start}>Drive again</button>
              <button type="button" className="ghost" onClick={toMenu}>Change drive</button>
            </div>
          )}
        </div>

        <div className="drive-pad">
          <SteeringWheel onChange={(v) => { touch.current.wheel = v }} />
          <div className="pad-pedals">
            <button type="button" className="ghost brake" aria-label="Brake" {...hold('brake')}>Brake</button>
            <button type="button" className="ghost gas" aria-label="Accelerate" {...hold('gas')}>Gas</button>
          </div>
        </div>
      </div>
    </>
  )
}
