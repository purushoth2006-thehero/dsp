import { useCallback, useEffect, useRef, useState } from 'react'
import { CAR_H, LANES, PLAYER_Y, moveLane, newGame, scoreOf, step } from '../../game.js'

const W = 360
const H = 560
const ROAD_X = 30
const ROAD_W = W - ROAD_X * 2
const LANE_W = ROAD_W / LANES
const CAR_COLORS = ['#2f6fd6', '#f2f2f2', '#2b3036', '#e08a00', '#0e7c47']
const BEST_KEY = 'dsp-car-game-best'

const readBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 } }
const saveBest = (n) => { try { localStorage.setItem(BEST_KEY, String(n)) } catch { /* private mode: best score is not kept */ } }

function drawCar(ctx, cx, y, color, plate) {
  const w = LANE_W * 0.56
  const h = CAR_H * H
  const x = cx - w / 2
  ctx.fillStyle = 'rgba(0,0,0,.25)'
  ctx.fillRect(x + 3, y + 4, w, h)
  ctx.fillStyle = color
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 9); ctx.fill()
  ctx.fillStyle = 'rgba(20,28,36,.85)' // windscreen and rear window
  ctx.beginPath(); ctx.roundRect(x + 5, y + h * 0.2, w - 10, h * 0.2, 4); ctx.fill()
  ctx.beginPath(); ctx.roundRect(x + 6, y + h * 0.66, w - 12, h * 0.14, 4); ctx.fill()
  ctx.fillStyle = '#ffd23f' // headlights
  ctx.fillRect(x + 3, y + 2, 7, 4); ctx.fillRect(x + w - 10, y + 2, 7, 4)
  if (plate) { // the L-plate on the bonnet
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 8, y + h * 0.43, 16, 16)
    ctx.fillStyle = '#b91c22'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('L', cx, y + h * 0.43 + 13)
  }
}

function draw(ctx, g, carX) {
  ctx.fillStyle = '#1c7a43' // grass
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#2b3036' // tarmac
  ctx.fillRect(ROAD_X, 0, ROAD_W, H)
  ctx.fillStyle = '#fff' // road edges
  ctx.fillRect(ROAD_X - 4, 0, 4, H); ctx.fillRect(ROAD_X + ROAD_W, 0, 4, H)
  ctx.fillStyle = '#ffc400' // dashed lane lines that scroll as you drive
  const dash = 36
  const offset = (g.distance * H) % (dash * 2)
  for (let i = 1; i < LANES; i += 1) {
    for (let y = -dash * 2 + offset; y < H; y += dash * 2) ctx.fillRect(ROAD_X + i * LANE_W - 2, y, 4, dash)
  }
  for (const e of g.enemies) drawCar(ctx, ROAD_X + (e.lane + 0.5) * LANE_W, e.y * H, CAR_COLORS[e.color % CAR_COLORS.length], false)
  drawCar(ctx, carX, PLAYER_Y * H, '#b91c22', true)
}

// A small lane-dodging game: steer between the lanes and keep clear of the other cars.
export default function CarGame() {
  const canvasRef = useRef(null)
  const gameRef = useRef(newGame())
  const carXRef = useRef(ROAD_X + 1.5 * LANE_W)
  const rafRef = useRef(0)
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)

  const steer = useCallback((dir) => { gameRef.current = moveLane(gameRef.current, dir) }, [])

  const start = useCallback(() => {
    gameRef.current = newGame()
    carXRef.current = ROAD_X + 1.5 * LANE_W
    setScore(0)
    setPhase('playing')
  }, [])

  // The game loop runs only while playing.
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    if (phase !== 'playing') { draw(ctx, gameRef.current, carXRef.current); return undefined }
    let last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const g = step(gameRef.current, dt)
      gameRef.current = g
      const target = ROAD_X + (g.lane + 0.5) * LANE_W
      carXRef.current += (target - carXRef.current) * Math.min(1, dt * 14) // glide into the lane
      draw(ctx, g, carXRef.current)
      setScore(scoreOf(g))
      if (g.over) {
        setPhase('over')
        setBest((b) => { const next = Math.max(b, scoreOf(g)); saveBest(next); return next })
        return
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { steer(-1); e.preventDefault() }
      else if (['ArrowRight', 'd', 'D'].includes(e.key)) { steer(1); e.preventDefault() }
      else if ((e.key === ' ' || e.key === 'Enter') && phase !== 'playing' && !(e.target instanceof HTMLButtonElement)) { start(); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, start, steer])

  // Tap the left or right half of the road to steer.
  const onPointer = (e) => {
    if (phase !== 'playing') return
    const rect = e.currentTarget.getBoundingClientRect()
    steer(e.clientX - rect.left < rect.width / 2 ? -1 : 1)
  }

  return (
    <>
      <h1>Car game</h1>
      <div className="game">
        <div className="game-bar">
          <span>Distance: <b>{score} m</b></span>
          <span>Best: <b>{Math.max(best, score)} m</b></span>
        </div>
        <div className="game-stage">
          <canvas ref={canvasRef} width={W} height={H} onPointerDown={onPointer} aria-label="Car game road" />
          {phase !== 'playing' && (
            <div className="game-overlay">
              <h2>{phase === 'over' ? 'Crash!' : 'Keep clear of the traffic'}</h2>
              {phase === 'over' && <p>You drove {score} m.</p>}
              <ul className="lines">
                <li>Arrow keys or A / D to change lane</li>
                <li>On a phone, tap left or right</li>
              </ul>
              <button type="button" className="primary" onClick={start}>{phase === 'over' ? 'Play again' : 'Start'}</button>
            </div>
          )}
        </div>
        <div className="game-pad">
          <button type="button" className="ghost" onClick={() => steer(-1)} aria-label="Move left">◀ Left</button>
          <button type="button" className="ghost" onClick={() => steer(1)} aria-label="Move right">Right ▶</button>
        </div>
      </div>
    </>
  )
}
