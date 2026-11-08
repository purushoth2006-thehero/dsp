// A small driving simulator with no React or canvas, so the rules can be tested.
// World units are metres. A car's heading is an angle in radians: 0 points up the screen (-y)
// and the angle grows clockwise, so the car moves along (sin heading, -cos heading).

export const CAR = { length: 4.2, width: 1.9, wheelbase: 2.7 }
export const ROAD_HALF = 4.5 // half the road width: a 9 m wide road
export const SPEED_LIMIT = 60 / 3.6 // 60 km/h in m/s
export const MAX_SPEED = 32 // about 115 km/h
const MAX_REVERSE = 6
const CONE_R = 0.3

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const kmh = (v) => Math.round(Math.abs(v) * 3.6)

// ---------- the car ----------

export const newCar = (x = 0, y = 0, heading = 0) => ({ x, y, heading, v: 0, steer: 0, braking: false })

// One step of driving. inp = { throttle: 0..1, brake: 0..1, steer: -1 (left) .. 1 (right) }.
export function stepCar(c, inp, dt, offroad = false, gripScale = 1) {
  const throttle = clamp(inp.throttle ?? 0, 0, 1)
  const brake = clamp(inp.brake ?? 0, 0, 1)
  let v = c.v
  let a = 0
  let reversing = false

  if (throttle > 0) a += 10 * throttle * (1 - Math.max(0, v) / 36)
  if (brake > 0) {
    if (v > 0.3) a -= 15 * brake // braking
    else if (throttle === 0) { reversing = true; a -= 4 * brake * clamp(1 + v / MAX_REVERSE, 0, 1) } // then reverse
  }
  // Air and rolling resistance; grass and gravel drag much harder.
  const drag = offroad ? 2.5 + 0.03 * v * v : 0.3 + 0.002 * v * v
  a -= Math.sign(v) * drag
  if (offroad && v > 12) a -= (v - 12) * 1.2

  const before = v
  v += a * dt
  if (!reversing && before !== 0 && Math.sign(before) !== Math.sign(v)) v = 0 // drag and brakes stop the car; they never reverse it
  if (throttle === 0 && !reversing && Math.abs(v) < 0.05) v = 0
  v = clamp(v, -MAX_REVERSE, MAX_SPEED)

  // The steering wheel turns gradually, and the wheels turn less at speed.
  const rate = inp.steer === 0 ? 7 : 3.5
  const steer = c.steer + clamp((inp.steer ?? 0) - c.steer, -rate * dt, rate * dt)
  const maxAngle = 0.62 / (1 + (Math.abs(v) / 14) ** 2) + 0.05
  let turn = (v / CAR.wheelbase) * Math.tan(steer * maxAngle)
  const grip = (offroad ? 5 : 9) * gripScale // the most sideways acceleration the tyres can hold (less on a wet road)
  if (Math.abs(turn * v) > grip) turn = (Math.sign(turn) * grip) / Math.abs(v) // beyond that the car understeers

  const heading = c.heading + turn * dt
  return {
    x: c.x + Math.sin(heading) * v * dt,
    y: c.y - Math.cos(heading) * v * dt,
    heading, v, steer, braking: brake > 0 && before > 0.3,
  }
}

// ---------- the track ----------

const CONTROL = [
  [0, 0], [0, -120], [40, -200], [130, -230], [210, -190], [230, -110], [190, -40],
  [120, -20], [100, 40], [130, 110], [90, 170], [10, 180], [-60, 140], [-70, 60], [-50, 10],
]

// A smooth closed curve through the control points (Catmull-Rom).
function smoothLoop(points, per = 14) {
  const out = []
  const n = points.length
  for (let i = 0; i < n; i += 1) {
    const [p0, p1, p2, p3] = [points[(i + n - 1) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]]
    for (let k = 0; k < per; k += 1) {
      const t = k / per
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) })
    }
  }
  return out
}

const segDist = (px, py, a, b) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy), 0, 1)
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

// The closest part of the road to (x, y). Give a `near` index to look only around it.
export function nearest(track, x, y, near = null) {
  const { pts, n } = track
  let best = { index: 0, dist: Infinity }
  const range = near === null ? n : 24
  for (let k = 0; k < range; k += 1) {
    const i = near === null ? k : (near - 12 + k + n) % n
    const d = segDist(x, y, pts[i], pts[(i + 1) % n])
    if (d < best.dist) best = { index: i, dist: d }
  }
  return best
}

export function buildTrack() {
  const pts = smoothLoop(CONTROL)
  const n = pts.length
  const track = { pts, n, checkpoints: 8 }
  const at = (i) => {
    const a = pts[i % n]
    const b = pts[(i + 1) % n]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    return { x: a.x, y: a.y, tx: (b.x - a.x) / len, ty: (b.y - a.y) / len }
  }
  track.start = { ...pts[0], heading: Math.atan2(at(0).tx, -at(0).ty) }
  // Cones to weave through, alternating sides of the road.
  track.cones = []
  for (let j = 0; j < 14; j += 1) {
    const p = at(Math.floor(((j + 0.5) * n) / 14))
    const side = j % 2 === 0 ? 1 : -1
    track.cones.push({ x: p.x - p.ty * side * 2.3, y: p.y + p.tx * side * 2.3 })
  }
  // Bushes beside the road, so you can feel the speed.
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  let seed = 11
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  track.bushes = []
  while (track.bushes.length < 220) {
    const x = minX - 60 + rnd() * (maxX - minX + 120)
    const y = minY - 60 + rnd() * (maxY - minY + 120)
    if (nearest(track, x, y).dist > ROAD_HALF + 7) track.bushes.push({ x, y, r: 1.5 + rnd() * 2.5 })
  }
  return track
}

// ---------- one run round the track ----------

export const newRun = (track) => ({
  car: newCar(track.start.x, track.start.y, track.start.heading),
  index: 0, next: 1, started: false, finished: false,
  time: 0, offroadTime: 0, speedingTime: 0, hit: [],
})

const circularGap = (a, b, n) => { const d = Math.abs(a - b) % n; return Math.min(d, n - d) }

// Advances the run by dt seconds. The lap is done when every checkpoint was passed in order
// and the start line is crossed again.
// opts.grip scales the tyre grip (wet road); opts.free means free driving: no lap, no speeding count.
export function stepRun(run, track, inp, dt, opts = {}) {
  if (run.finished) return run
  const started = run.started || (inp.throttle ?? 0) > 0 || (inp.brake ?? 0) > 0
  const road = nearest(track, run.car.x, run.car.y, run.index)
  const offroad = road.dist > ROAD_HALF + CAR.width / 2 * 0.6
  const car = stepCar(run.car, inp, dt, offroad, opts.grip ?? 1)

  // Cones: hitting one knocks it over and slows the car.
  let v = car.v
  const hit = [...run.hit]
  const cos = Math.cos(car.heading)
  const sin = Math.sin(car.heading)
  track.cones.forEach((cone, i) => {
    if (hit.includes(i)) return
    const dx = cone.x - car.x
    const dy = cone.y - car.y
    const side = dx * cos + dy * sin // sideways, in the car's own frame
    const ahead = dx * sin - dy * cos // along the car
    if (Math.abs(side) < CAR.width / 2 + CONE_R && Math.abs(ahead) < CAR.length / 2 + CONE_R) { hit.push(i); v *= 0.6 }
  })

  const index = nearest(track, car.x, car.y, road.index).index
  const cp = Math.floor((run.next % track.checkpoints) * track.n / track.checkpoints)
  let next = run.next
  let finished = false
  if (!opts.free && started && circularGap(index, cp, track.n) <= 3) {
    next += 1
    finished = next > track.checkpoints
  }

  return {
    ...run, car: { ...car, v }, index, next, started, finished, hit, offroad,
    time: started ? run.time + dt : 0,
    offroadTime: run.offroadTime + (offroad ? dt : 0),
    speedingTime: run.speedingTime + (!opts.free && Math.abs(v) > SPEED_LIMIT + 0.5 ? dt : 0),
  }
}

// Careful driving counts more than speed: 100 points, minus for knocked cones, time on the grass and speeding.
export const drivingScore = (run) =>
  Math.max(0, Math.round(100 - run.hit.length * 5 - run.offroadTime * 3 - run.speedingTime * 1.5))

// ---------- weather ----------

export const WEATHER = {
  clear: { label: 'Clear', grip: 1 },
  rain: { label: 'Rain', grip: 0.62 }, // a wet road: the tyres hold less, so slow down for bends
  night: { label: 'Night', grip: 1 },
}

// ---------- the parking lot (reverse parking) ----------

export const LOT_HALF = { x: 30, y: 26 }
const BAY = { width: 3.2, length: 5.6, count: 9, target: 4 }
const wrapAngle = (a) => { let r = a; while (r > Math.PI) r -= 2 * Math.PI; while (r < -Math.PI) r += 2 * Math.PI; return r }

export function buildLot() {
  const bayY = -LOT_HALF.y + 2 + BAY.length / 2 // the bays sit along the top wall
  const x0 = -(BAY.count * BAY.width) / 2 + BAY.width / 2
  const bays = Array.from({ length: BAY.count }, (_, i) => ({ x: x0 + i * BAY.width, y: bayY, w: BAY.width, l: BAY.length }))
  const parked = bays
    .map((b, i) => ({ x: b.x, y: b.y + 0.2, heading: 0, w: CAR.width, l: CAR.length, color: i % 5 }))
    .filter((_, i) => i !== BAY.target)
  return { bays, target: bays[BAY.target], parked, start: { x: -21, y: 8, heading: Math.PI / 2 } }
}

// The four corners of a car (or any rotated rectangle w x l at x, y).
export function corners(x, y, heading, w, l) {
  const s = Math.sin(heading)
  const c = Math.cos(heading)
  return [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]].map(([a, b]) => ({ x: x + a * c + b * s, y: y + a * s - b * c }))
}

// Do two rotated rectangles overlap? (separating axis test)
export function overlap(p, q) {
  for (const poly of [p, q]) {
    for (let i = 0; i < 4; i += 1) {
      const a = poly[i]
      const b = poly[(i + 1) % 4]
      const nx = -(b.y - a.y)
      const ny = b.x - a.x
      const range = (pts) => { const d = pts.map((pt) => pt.x * nx + pt.y * ny); return [Math.min(...d), Math.max(...d)] }
      const [a0, a1] = range(p)
      const [b0, b1] = range(q)
      if (a1 < b0 || b1 < a0) return false
    }
  }
  return true
}

export const newParkingRun = (lot) => ({
  car: newCar(lot.start.x, lot.start.y, lot.start.heading),
  started: false, finished: false, time: 0, hits: 0, contact: false, hold: 0,
})

// Back the car into the empty bay, nose out, and stop inside the lines.
export function stepParking(run, lot, inp, dt) {
  if (run.finished) return run
  const started = run.started || (inp.throttle ?? 0) > 0 || (inp.brake ?? 0) > 0
  let car = stepCar(run.car, inp, dt, false)
  const box = corners(car.x, car.y, car.heading, CAR.width, CAR.length)
  const outside = box.some((p) => Math.abs(p.x) > LOT_HALF.x || Math.abs(p.y) > LOT_HALF.y)
  const touching = outside || lot.parked.some((o) => overlap(box, corners(o.x, o.y, o.heading, o.w, o.l)))
  let hits = run.hits
  if (touching) { // a bump: the car stops where it was
    car = { ...run.car, v: 0, steer: car.steer, braking: false }
    if (!run.contact) hits += 1
  }
  const t = lot.target
  const inBay = box.every((p) => Math.abs(p.x - t.x) <= t.w / 2 && Math.abs(p.y - t.y) <= t.l / 2)
  const straight = Math.abs(wrapAngle(car.heading - Math.PI)) < 0.18 // facing out of the bay: backed in
  const parked = !touching && inBay && straight && Math.abs(car.v) < 0.3
  const hold = parked ? run.hold + dt : 0
  return { ...run, car, started, hits, contact: touching, hold, finished: hold >= 0.8, time: started ? run.time + dt : 0 }
}

// 100 points, minus 10 per bump and a little for every second over 45.
export const parkingScore = (run) => Math.max(0, Math.round(100 - run.hits * 10 - Math.max(0, run.time - 45) * 0.8))
