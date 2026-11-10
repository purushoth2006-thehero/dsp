import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GEAR_TOP, SPEED_LIMIT, WEATHER, buildLot, buildTrack, drivingScore, gearLabel, kmh, newParkingRun, newRun, parkingScore, stepParking, stepRun,
} from '../../drive.js'
import { Link } from 'react-router-dom'
import { VIEWS, VIEW_LABEL } from '../../camera.js'
import { draw3D, drawTop } from '../../render.js'
import SteeringWheel from './SteeringWheel.jsx'
import GearShifter from './GearShifter.jsx'
import Gauge from './Gauge.jsx'
import { createEngine } from '../../engineSound.js'

const BEST_KEY = 'dsp-drive-best'

// On a phone the game takes the whole screen, so the road and the controls are both in view and the page cannot scroll.
const SMALL = '(max-width: 820px), (pointer: coarse)'
// A phone held on its side: very little height, so the game fills the screen even at the menu.
const SIDEWAYS = '(orientation: landscape) and (max-height: 520px) and (pointer: coarse)'
const wrapAngle = (d) => ((((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI

const MODES = {
  test: { label: 'Driving test', hint: 'One lap, cones, 60 km/h limit', view: 'cockpit' },
  free: { label: 'Free drive', hint: 'No rules: just practise', view: 'cockpit' },
  park: { label: 'Reverse parking', hint: 'Back into the green bay', view: 'top' },
}

const readBest = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {} } catch { return {} } }
const saveBest = (b) => { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)) } catch { /* private mode: the best is not kept */ } }
// How fast the engine turns, 0 to 1: it climbs with the car's speed in a gear and falls back at each shift up.
const engineRpm = (g, v, throttle) => (g > 0 ? 0.18 + 0.82 * Math.min(1, Math.max(0, Math.abs(v)) / GEAR_TOP[g]) : g < 0 ? 0.18 + 0.5 * Math.min(1, Math.abs(v) / 6) : 0.18 + 0.7 * throttle)
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
  const gearRef = useRef(0) // manual gearbox: -1 reverse, 0 neutral, 1 to 5
  const [note, setNote] = useState('')
  const noteTimer = useRef(0)
  const engine = useRef(null)
  const [muted, setMuted] = useState(false)
  const [phase, setPhase] = useState('ready') // ready | playing | done
  const [hud, setHud] = useState({ speed: 0, gear: 'N', gearNo: 0, rpm: 0.18, time: 0, count: 0, over: false, shift: false })
  const [result, setResult] = useState(null)
  const [best, setBest] = useState(readBest)
  const stageRef = useRef(null)
  const [size, setSize] = useState({ w: 420, h: 560 })
  const [small, setSmall] = useState(() => window.matchMedia(SMALL).matches)
  const [sideways, setSideways] = useState(() => window.matchMedia(SIDEWAYS).matches)
  const full = !small || phase !== 'ready' || sideways // a computer always plays full screen
  const camH = useRef(0) // the camera heading trails the car a little, so turns swing smoothly instead of snapping

  const pickMode = (m) => {
    setMode(m)
    setView(MODES[m].view)
    runRef.current = m === 'park' ? newParkingRun(lot) : newRun(track)
  }

  useEffect(() => {
    const mq = window.matchMedia(SMALL)
    const mq2 = window.matchMedia(SIDEWAYS)
    const on = () => { setSmall(mq.matches); setSideways(mq2.matches) }
    mq.addEventListener('change', on)
    mq2.addEventListener('change', on)
    return () => { mq.removeEventListener('change', on); mq2.removeEventListener('change', on) }
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

  useEffect(() => {
    engine.current = createEngine()
    const e = engine.current
    return () => { e.stop(); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  }, [])

  const start = useCallback(() => {
    engine.current.start() // sound can only begin after a tap, and this is one
    if (!window.matchMedia(SMALL).matches && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}) // a computer: hide the browser bars too
    runRef.current = mode === 'park' ? newParkingRun(lot) : newRun(track)
    touch.current = { gas: false, brake: false, wheel: null }
    gearRef.current = 0
    setNote('Shift up to gear 1 to move (▲ or E)')
    setResult(null)
    setHud({ speed: 0, gear: 'N', gearNo: 0, rpm: 0.18, time: 0, count: 0, over: false, shift: false })
    setPhase('playing')
  }, [mode, lot, track])

  const toMenu = () => {
    engine.current.stop()
    runRef.current = mode === 'park' ? newParkingRun(lot) : newRun(track)
    setPhase('ready')
  }

  const flash = useCallback((text) => { setNote(text); clearTimeout(noteTimer.current); noteTimer.current = setTimeout(() => setNote(''), 2200) }, [])

  // Moves to a gear. Reverse can only be picked, or left, when the car is almost stopped.
  const shiftTo = useCallback((g) => {
    const target = Math.max(-1, Math.min(5, g))
    const cur = gearRef.current
    if (target === cur) return
    const stopped = Math.abs(runRef.current.car.v) < 1.5
    if ((target < 0 || cur < 0) && target !== 0 && !stopped) { flash('Stop the car before reverse'); return }
    if (cur < 0 && target > 0 && !stopped) { flash('Stop the car first'); return }
    gearRef.current = target
    setHud((h) => ({ ...h, gear: gearLabel(target), gearNo: target }))
    flash(target === 0 ? 'Neutral: the car rolls' : target < 0 ? 'Reverse' : `Gear ${target}`)
  }, [flash])

  const cycleView = useCallback(() => setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]), [])

  const readInput = () => {
    const k = keys.current
    const t = touch.current
    const key = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0)
    return {
      throttle: k.has('ArrowUp') || k.has('w') || t.gas ? 1 : 0,
      brake: k.has('ArrowDown') || k.has('s') || k.has(' ') || t.brake ? 1 : 0,
      steer: key !== 0 ? key : (t.wheel ?? 0),
      direct: key === 0 && t.wheel !== null,
      gear: gearRef.current,
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
    const paint = (run, time, dt = 0) => {
      // ease the camera round behind the car; the driver's seat follows more closely than the chase camera
      if (dt === 0) camH.current = run.car.heading
      else camH.current += wrapAngle(run.car.heading - camH.current) * (1 - Math.exp(-dt * (view === 'cockpit' ? 16 : 6.5)))
      const o = { view, weather, W: w, H: h, time, offroad: Boolean(run.offroad), wheel: false, camHeading: camH.current }
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
      engine.current.set(engineRpm(gearRef.current, runRef.current.car.v, inp.throttle), inp.throttle)
      const run = park
        ? stepParking(runRef.current, lot, inp, dt)
        : stepRun(runRef.current, track, inp, dt, { grip: WEATHER[weather].grip, free: mode === 'free' })
      runRef.current = run
      paint(run, now / 1000, dt)
      if (now - lastHud > 90) {
        lastHud = now
        setHud({
          speed: kmh(run.car.v), gear: gearLabel(gearRef.current), gearNo: gearRef.current, rpm: engineRpm(gearRef.current, run.car.v, inp.throttle), shift: gearRef.current > 0 && run.car.v > GEAR_TOP[gearRef.current] * 0.93,
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
        engine.current.stop()
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
      if (e.repeat && (key === 'c' || key === 'e' || key === 'q')) return
      if (key === 'c') { cycleView(); return }
      if (phase === 'playing') {
        if (key === 'e') { shiftTo(gearRef.current + 1); return }
        if (key === 'q') { shiftTo(gearRef.current - 1); return }
        if (key === 'n') { shiftTo(0); return }
        if (key === 'r') { shiftTo(-1); return }
        if (/^[1-5]$/.test(key)) { shiftTo(Number(key)); return }
      }
      if (!drive.has(key)) { if (e.key === 'Enter' && phase !== 'playing' && !(e.target instanceof HTMLButtonElement)) start(); return }
      if (phase === 'playing') e.preventDefault()
      keys.current.add(key)
    }
    const up = (e) => keys.current.delete(normal(e))
    const clear = () => { keys.current.clear(); touch.current.gas = false; touch.current.brake = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', clear)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear) }
  }, [phase, start, cycleView, shiftTo])

  // A pedal on the screen is "held" for as long as the finger stays on it.
  const hold = (name) => ({
    onPointerDown: (e) => {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* the finger is tracked without capture */ }
      touch.current[name] = true
    },
    onPointerUp: () => { touch.current[name] = false },
    onPointerCancel: () => { touch.current[name] = false },
    onLostPointerCapture: () => { touch.current[name] = false },
    onContextMenu: (e) => e.preventDefault(),
  })

  const m = MODES[mode]
  const bestLine = mode === 'test' && best.test ? `Best time: ${fmt(best.test)}` : mode === 'park' && best.park ? `Best score: ${best.park} / 100` : ''

  return (
    <>
      <h1>Driving practice</h1>
      <div className={`game${full ? ' full' : ''}${phase === 'ready' ? ' idle' : ''}`}>
        <div className="drive-hud">
          <div className="dials">
            <Gauge value={hud.speed} max={160} step={20} labelEvery={2} redFrom={mode === 'test' ? (SPEED_LIMIT * 3.6) / 160 : 1} text={String(hud.speed)} unit="km/h" warn={hud.over} label="Speed" />
            <Gauge value={hud.rpm * 8} max={8} step={1} redFrom={0.84} text={gearLabel(hud.gearNo)} unit="x1000 rpm" warn={hud.shift} label="Engine speed" />
          </div>
          <div className={`gear${hud.shift ? ' shift' : ''}`} aria-label={`Gear ${hud.gear}`}>{hud.gear}</div>
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
          {phase !== 'ready' && (
            <button type="button" className="view-btn sound-btn" aria-pressed={muted} aria-label={muted ? 'Turn the engine sound on' : 'Turn the engine sound off'}
              onClick={() => { const m = !muted; setMuted(m); engine.current.setMuted(m) }}>{muted ? '🔇' : '🔊'}</button>
          )}
          {phase === 'playing' && note && <div className="game-note" role="status">{note}</div>}
          {phase === 'playing' && hud.shift && <div className="game-note warn" role="status">Shift up</div>}
          {phase === 'ready' && (
            <div className="game-overlay menu">
              {full && <Link className="menu-close" to="/" aria-label="Leave the game">✕</Link>}
              <h2>Choose a drive</h2>
              <div className="menu-col">
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
              </div>
              <div className="menu-col">
              <ul className="lines">
                <li>Drag the wheel to steer, hold Gas to go</li>
                <li>Manual gears: ▲ E up, ▼ Q down. Start in 1, go up as you speed up</li>
                <li>Stop the car to select R and reverse</li>
                <li>Keyboard: W A S D or arrows, C changes camera</li>
              </ul>
              {bestLine && <p>{bestLine}</p>}
              <button type="button" className="primary" onClick={start}>Start engine</button>
              </div>
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
          <GearShifter gear={hud.gearNo} onPick={shiftTo} />
          <div className="pad-pedals">
            <button type="button" className="ghost brake" aria-label="Brake" {...hold('brake')}>Brake</button>
            <button type="button" className="ghost gas" aria-label="Accelerate" {...hold('gas')}>Gas</button>
          </div>
        </div>
      </div>
    </>
  )
}
