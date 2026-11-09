// Everything that is drawn on the game canvas: the top view, and the two 3D views (behind the car, driver's seat).
import { CAR, LOT_HALF, ROAD_HALF } from './drive.js'
import { makeCamera, project, projectPoly, toCamera } from './camera.js'

const CAR_COLORS = ['#2f6fd6', '#f2f2f2', '#2b3036', '#e08a00', '#0e7c47']
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ---------- weather on top of the picture ----------

function drawWeather(ctx, weather, W, H, time, light) {
  if (weather === 'rain') {
    ctx.fillStyle = 'rgba(30, 44, 66, .2)'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(210, 225, 245, .45)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let i = 0; i < 110; i += 1) {
      const x = ((i * 137.5) % W) + ((time * 140) % 40) * 0.3
      const y = ((i * 91.3 + time * 900) % (H + 40)) - 20
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16)
    }
    ctx.stroke()
  } else if (weather === 'night') {
    const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r)
    g.addColorStop(0, 'rgba(0, 0, 12, .1)'); g.addColorStop(0.45, 'rgba(0, 0, 12, .6)'); g.addColorStop(1, 'rgba(0, 0, 12, .9)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
}

// ---------- the car seen from above ----------

export function drawCarTop(ctx, car, bodyColor = '#c8202a', roofColor) {
  const L = CAR.length
  const Wd = CAR.width
  const hw = Wd / 2
  const hl = L / 2
  ctx.save()
  ctx.translate(car.x, car.y)
  ctx.rotate(car.heading)
  ctx.fillStyle = 'rgba(0,0,0,.32)'
  ctx.beginPath(); ctx.roundRect(-hw + 0.2, -hl + 0.3, Wd, L, 0.7); ctx.fill()
  // tyres: the front pair turns with the steering
  ctx.fillStyle = '#0c0d0f'
  const tyre = (x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.roundRect(-0.2, -0.5, 0.4, 1, 0.1); ctx.fill(); ctx.restore() }
  const turn = (car.steer ?? 0) * 0.5
  tyre(-hw - 0.02, -hl + 0.95, turn); tyre(hw + 0.02, -hl + 0.95, turn); tyre(-hw - 0.02, hl - 0.85, 0); tyre(hw + 0.02, hl - 0.85, 0)
  // side mirrors
  ctx.fillStyle = bodyColor
  ctx.beginPath(); ctx.roundRect(-hw - 0.22, -hl + 1.5, 0.28, 0.2, 0.06); ctx.roundRect(hw - 0.06, -hl + 1.5, 0.28, 0.2, 0.06); ctx.fill()
  // body: narrow nose, wider middle, short tail
  const body = new Path2D()
  body.moveTo(-hw * 0.72, -hl)
  body.quadraticCurveTo(0, -hl - 0.12, hw * 0.72, -hl)
  body.bezierCurveTo(hw * 0.98, -hl + 0.3, hw, -hl + 0.9, hw, -hl + 1.5)
  body.lineTo(hw, hl - 0.8)
  body.bezierCurveTo(hw, hl - 0.25, hw * 0.88, hl - 0.05, hw * 0.7, hl)
  body.quadraticCurveTo(0, hl + 0.08, -hw * 0.7, hl)
  body.bezierCurveTo(-hw * 0.88, hl - 0.05, -hw, hl - 0.25, -hw, hl - 0.8)
  body.lineTo(-hw, -hl + 1.5)
  body.bezierCurveTo(-hw, -hl + 0.9, -hw * 0.98, -hl + 0.3, -hw * 0.72, -hl)
  body.closePath()
  const paint = ctx.createLinearGradient(-hw, 0, hw, 0)
  paint.addColorStop(0, shade(bodyColor, 0.72)); paint.addColorStop(0.5, shade(bodyColor, 1.18)); paint.addColorStop(1, shade(bodyColor, 0.72))
  ctx.fillStyle = paint; ctx.fill(body)
  ctx.strokeStyle = shade(bodyColor, 0.5); ctx.lineWidth = 0.05; ctx.stroke(body)
  // bonnet crease
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 0.05
  ctx.beginPath(); ctx.moveTo(-hw * 0.5, -hl + 0.2); ctx.lineTo(-hw * 0.55, -hl + 1.35); ctx.moveTo(hw * 0.5, -hl + 0.2); ctx.lineTo(hw * 0.55, -hl + 1.35); ctx.stroke()
  // glass: windscreen, side windows and rear window around the roof
  ctx.fillStyle = '#15202a'
  ctx.beginPath(); ctx.moveTo(-hw * 0.78, -hl + 1.5); ctx.lineTo(hw * 0.78, -hl + 1.5); ctx.lineTo(hw * 0.7, -hl + 2.15); ctx.lineTo(-hw * 0.7, -hl + 2.15); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-hw * 0.66, hl - 1.15); ctx.lineTo(hw * 0.66, hl - 1.15); ctx.lineTo(hw * 0.78, hl - 0.55); ctx.lineTo(-hw * 0.78, hl - 0.55); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.roundRect(-hw * 0.9, -hl + 2.1, hw * 1.8, hl * 2 - 3.3, 0.15); ctx.fill()
  const roof = ctx.createLinearGradient(-hw, 0, hw, 0)
  const rc = roofColor ?? bodyColor
  roof.addColorStop(0, shade(rc, 0.9)); roof.addColorStop(0.5, shade(rc, 1.3)); roof.addColorStop(1, shade(rc, 0.9))
  ctx.fillStyle = roof
  ctx.beginPath(); ctx.roundRect(-hw * 0.7, -hl + 2.2, hw * 1.4, hl * 2 - 3.5, 0.28); ctx.fill()
  // lights
  ctx.fillStyle = '#fff6c2'
  ctx.beginPath(); ctx.ellipse(-hw * 0.62, -hl + 0.2, 0.26, 0.13, 0.3, 0, Math.PI * 2); ctx.ellipse(hw * 0.62, -hl + 0.2, 0.26, 0.13, -0.3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = car.braking ? '#ff2b2b' : '#8c1414'
  ctx.fillRect(-hw + 0.1, hl - 0.22, 0.5, 0.14); ctx.fillRect(hw - 0.6, hl - 0.22, 0.5, 0.14)
  if (car.braking) { ctx.fillStyle = 'rgba(255,60,60,.3)'; ctx.beginPath(); ctx.arc(-hw + 0.35, hl, 0.5, 0, Math.PI * 2); ctx.arc(hw - 0.35, hl, 0.5, 0, Math.PI * 2); ctx.fill() }
  ctx.restore()
}

// ---------- top view ----------

export function drawTop(ctx, scene, run, { W, H, weather, time, offroad, camHeading }) {
  const { car } = run
  ctx.fillStyle = scene.kind === 'lot' ? '#3a4047' : '#2d8a4e'
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  if (scene.kind === 'track') {
    const scale = 8.5 - Math.min(Math.abs(car.v), 30) * 0.1 // zoom out a little at speed
    ctx.translate(W / 2, H * 0.7); ctx.scale(scale, scale); ctx.rotate(-(camHeading ?? car.heading)); ctx.translate(-car.x, -car.y)
    drawTrackTop(ctx, scene.track, run)
  } else {
    const scale = Math.min((W - 16) / (LOT_HALF.x * 2), (H - 16) / (LOT_HALF.y * 2)) // the whole lot, north up
    ctx.translate(W / 2, H / 2); ctx.scale(scale, scale)
    drawLotTop(ctx, scene.lot)
  }
  drawCarTop(ctx, car)
  ctx.restore()

  if (scene.kind === 'track') drawMiniMap(ctx, scene.track, car, W, H)
  const light = scene.kind === 'track' ? { x: W / 2, y: H * 0.7, r: Math.max(W, H) * 0.55 } : { x: W / 2, y: H / 2, r: Math.max(W, H) * 0.7 }
  drawWeather(ctx, weather, W, H, time, light)
  if (offroad) { ctx.fillStyle = 'rgba(255,196,0,.95)'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Off the road: slow down and steer back', W / 2, 140) }
}

function drawTrackTop(ctx, track, run) {
  ctx.fillStyle = '#1f6e3c'
  for (const b of track.bushes) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill() }
  const path = new Path2D()
  track.pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)))
  path.closePath()
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#fff'; ctx.lineWidth = ROAD_HALF * 2 + 0.7; ctx.stroke(path)
  ctx.strokeStyle = '#2b3036'; ctx.lineWidth = ROAD_HALF * 2 - 0.1; ctx.stroke(path)
  ctx.strokeStyle = '#ffc400'; ctx.lineWidth = 0.22; ctx.setLineDash([3, 3]); ctx.stroke(path); ctx.setLineDash([])
  const a = track.pts[0]
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(track.start.heading)
  for (let i = 0; i < 9; i += 1) { ctx.fillStyle = i % 2 ? '#fff' : '#111'; ctx.fillRect(-ROAD_HALF + i, -0.5, 1, 1) }
  ctx.restore()
  ctx.lineCap = 'butt'
  for (const side of track.fence) { // the fence: red and white posts all round
    const f = new Path2D()
    side.forEach((p, i) => (i ? f.lineTo(p.x, p.y) : f.moveTo(p.x, p.y)))
    f.closePath()
    ctx.strokeStyle = '#d62828'; ctx.lineWidth = 0.5; ctx.stroke(f)
    ctx.strokeStyle = '#fff'; ctx.setLineDash([1.5, 1.5]); ctx.stroke(f); ctx.setLineDash([])
  }
  track.cones.forEach((c, i) => {
    if (run.hit.includes(i)) return
    ctx.fillStyle = '#ff7a00'; ctx.beginPath(); ctx.arc(c.x, c.y, 0.45, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, 0.2, 0, Math.PI * 2); ctx.fill()
  })
}

function drawLotTop(ctx, lot) {
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6
  ctx.strokeRect(-LOT_HALF.x, -LOT_HALF.y, LOT_HALF.x * 2, LOT_HALF.y * 2)
  ctx.lineWidth = 0.14
  for (const b of lot.bays) ctx.strokeRect(b.x - b.w / 2, b.y - b.l / 2, b.w, b.l)
  const t = lot.target
  ctx.fillStyle = 'rgba(74, 222, 128, .35)'; ctx.fillRect(t.x - t.w / 2, t.y - t.l / 2, t.w, t.l)
  ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 0.3; ctx.strokeRect(t.x - t.w / 2, t.y - t.l / 2, t.w, t.l)
  lot.parked.forEach((o) => drawCarTop(ctx, { x: o.x, y: o.y, heading: 0, steer: 0 }, CAR_COLORS[o.color % CAR_COLORS.length]))
}

function drawMiniMap(ctx, track, car, W, H) {
  const ms = Math.min(86, H * 0.22)
  const mx = W - ms - 10; const my = H < 480 ? 54 : 10 // lower on a phone held sideways, below the top bar
  const xs = track.pts.map((p) => p.x); const ys = track.pts.map((p) => p.y)
  const minX = Math.min(...xs); const minY = Math.min(...ys)
  const k = ms / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY)
  ctx.fillStyle = 'rgba(20,24,28,.55)'; ctx.fillRect(mx - 4, my - 4, ms + 8, ms + 8)
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath()
  track.pts.forEach((p, i) => (i ? ctx.lineTo(mx + (p.x - minX) * k, my + (p.y - minY) * k) : ctx.moveTo(mx + (p.x - minX) * k, my + (p.y - minY) * k)))
  ctx.closePath(); ctx.stroke()
  ctx.fillStyle = '#ffc400'; ctx.beginPath(); ctx.arc(mx + (car.x - minX) * k, my + (car.y - minY) * k, 3.5, 0, Math.PI * 2); ctx.fill()
}

// ---------- 3D views ----------

const PALETTE = {
  clear: { skyTop: '#4a90d9', skyLow: '#bfe3ff', grass: '#2f7a46', grassFar: '#4f9a62', road: ['#2b3036', '#30363c'], hills: '#5a8f7b' },
  rain: { skyTop: '#59636e', skyLow: '#a4adb5', grass: '#2a6a40', grassFar: '#44765a', road: ['#23282d', '#272d33'], hills: '#58706a' },
  night: { skyTop: '#05070d', skyLow: '#16223a', grass: '#143a24', grassFar: '#1b4a30', road: ['#22272c', '#272c32'], hills: '#10202c' },
}

const fillPoly = (ctx, poly, color) => {
  if (!poly) return
  ctx.fillStyle = color
  ctx.beginPath()
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath(); ctx.fill()
}
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => clamp(Math.round(v * f), 0, 255)
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`
}

// A box standing on the ground: x, y is its middle, heading its direction, z0 where it starts and h how tall it is.
function drawBox(ctx, cam, x, y, heading, w, l, z0, h, color) {
  const s = Math.sin(heading); const c = Math.cos(heading)
  const g = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]].map(([a, b]) => [x + a * c + b * s, y + a * s - b * c])
  const faces = g.map((p, i) => { const q = g[(i + 1) % 4]; return { pts: [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z0 + h], [p[0], p[1], z0 + h]], f: 0.7 + (i % 2) * 0.25 } })
  faces.push({ pts: g.map((p) => [p[0], p[1], z0 + h]), f: 1.1 })
  faces.forEach((fc) => { fc.z = fc.pts.reduce((sum, p) => sum + toCamera(cam, p[0], p[1]).z, 0) / fc.pts.length })
  faces.sort((a, b) => b.z - a.z)
  for (const fc of faces) fillPoly(ctx, projectPoly(cam, fc.pts), shade(color, fc.f))
}

export function draw3D(ctx, scene, run, { view, weather, W, H, time, wheel = true, camHeading }) {
  const { car } = run
  const cam = makeCamera(view, camHeading === undefined ? car : { ...car, heading: camHeading }, W, H)
  const pal = PALETTE[weather] ?? PALETTE.clear

  const sky = ctx.createLinearGradient(0, 0, 0, cam.horizon)
  sky.addColorStop(0, pal.skyTop); sky.addColorStop(1, pal.skyLow)
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, cam.horizon + 1)
  ctx.fillStyle = pal.hills // hills far away; they slide sideways as the car turns
  ctx.beginPath(); ctx.moveTo(0, cam.horizon)
  const shift = -cam.heading * W * 1.1
  for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, cam.horizon - (22 + 14 * Math.sin((x + shift) * 0.011) + 9 * Math.sin((x + shift) * 0.029)))
  ctx.lineTo(W, cam.horizon); ctx.closePath(); ctx.fill()
  const ground = ctx.createLinearGradient(0, cam.horizon, 0, H)
  ground.addColorStop(0, pal.grassFar); ground.addColorStop(1, pal.grass)
  ctx.fillStyle = ground; ctx.fillRect(0, cam.horizon, W, H - cam.horizon)

  if (scene.kind === 'track') drawTrack3D(ctx, scene.track, run, cam, pal)
  else drawLot3D(ctx, scene.lot, cam, pal)

  if (view === 'chase') drawCarRear(ctx, cam, car)
  else drawCockpit(ctx, W, H, car, wheel)
  drawWeather(ctx, weather, W, H, time, { x: W / 2, y: view === 'chase' ? H * 0.72 : H * 0.7, r: H * 0.8 })
}

function drawTrack3D(ctx, track, run, cam, pal) {
  const { pts, n } = track
  const P = (i) => pts[((i % n) + n) % n]
  const normal = (i) => { // a smooth sideways direction at point i
    const a = P(i - 1); const b = P(i + 1)
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }
  }
  const edge = (i, off) => { const p = P(i); const nm = normal(i); return [p.x + nm.x * off, p.y + nm.y * off, 0] }
  const quad = (i, offA, offB, color) => fillPoly(ctx, projectPoly(cam, [edge(i, offA), edge(i, offB), edge(i + 1, offB), edge(i + 1, offA)]), color)

  for (let i = run.index + 72; i >= run.index - 8; i -= 1) {
    quad(i, -ROAD_HALF - 0.4, ROAD_HALF + 0.4, '#fff') // white edges
    quad(i, -ROAD_HALF, ROAD_HALF, pal.road[(i >> 1) & 1])
    if (i % 2 === 0) quad(i, -0.11, 0.11, '#ffc400') // centre dashes
    if (((i % n) + n) % n === 0) { // start / finish line
      for (let k = 0; k < 9; k += 1) quad(i, -ROAD_HALF + k, -ROAD_HALF + k + 1, k % 2 ? '#fff' : '#111')
    }
  }

  const items = []
  for (const b of track.bushes) { const { z, r } = toCamera(cam, b.x, b.y); if (z > 1 && z < 150 && Math.abs(r) < z * 1.4 + 12) items.push({ z, kind: 'tree', b }) }
  track.cones.forEach((c, i) => { if (run.hit.includes(i)) return; const { z, r } = toCamera(cam, c.x, c.y); if (z > 0.6 && z < 150 && Math.abs(r) < z * 1.4 + 10) items.push({ z, kind: 'cone', c }) })
  for (const f of track.fence) {
    for (let i = run.index + 60; i >= run.index - 6; i -= 1) {
      const a = f[((i % n) + n) % n]; const b = f[(((i + 1) % n) + n) % n]
      const z = toCamera(cam, (a.x + b.x) / 2, (a.y + b.y) / 2).z
      if (z > 0.5 && z < 150) items.push({ z, kind: 'fence', a, b, red: (i >> 1) & 1 })
    }
  }
  items.sort((a, b) => b.z - a.z)
  for (const it of items) {
    if (it.kind === 'fence') {
      const { a, b } = it
      fillPoly(ctx, projectPoly(cam, [[a.x, a.y, 0.15], [b.x, b.y, 0.15], [b.x, b.y, 0.95], [a.x, a.y, 0.95]]), it.red ? '#d62828' : '#f1f1f1')
      fillPoly(ctx, projectPoly(cam, [[a.x, a.y, 0], [b.x, b.y, 0], [b.x, b.y, 0.15], [a.x, a.y, 0.15]]), '#555')
    } else if (it.kind === 'tree') {
      const { x, y, r } = it.b
      const base = project(cam, x, y, 0); const top = project(cam, x, y, 2.4 + r * 0.5)
      if (!base || !top) continue
      ctx.fillStyle = '#5b3a1e'; ctx.fillRect(base.x - 0.2 * base.k, top.y, 0.4 * base.k, base.y - top.y)
      ctx.fillStyle = '#1f6e3c'; ctx.beginPath(); ctx.arc(top.x, top.y, r * 0.9 * base.k, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(120, 200, 120, .35)'; ctx.beginPath(); ctx.arc(top.x - r * 0.25 * base.k, top.y - r * 0.25 * base.k, r * 0.45 * base.k, 0, Math.PI * 2); ctx.fill()
    } else {
      const base = project(cam, it.c.x, it.c.y, 0); const top = project(cam, it.c.x, it.c.y, 0.8)
      if (!base || !top) continue
      const w = 0.3 * base.k
      ctx.fillStyle = '#ff7a00'; ctx.beginPath(); ctx.moveTo(base.x - w, base.y); ctx.lineTo(base.x + w, base.y); ctx.lineTo(top.x + w * 0.12, top.y); ctx.lineTo(top.x - w * 0.12, top.y); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.fillRect(base.x - w * 0.62, base.y - (base.y - top.y) * 0.55, w * 1.24, (base.y - top.y) * 0.18)
    }
  }
}

function drawLot3D(ctx, lot, cam, pal) {
  const H0 = LOT_HALF
  const flat = (x0, y0, x1, y1, color, z = 0) => fillPoly(ctx, projectPoly(cam, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]), color)
  flat(-H0.x - 40, -H0.y - 40, H0.x + 40, H0.y + 40, pal.grass)
  flat(-H0.x, -H0.y, H0.x, H0.y, pal.road[0])
  const t = lot.target
  flat(t.x - t.w / 2, t.y - t.l / 2, t.x + t.w / 2, t.y + t.l / 2, 'rgba(74, 222, 128, .55)')
  for (const b of lot.bays) { // bay lines
    flat(b.x - b.w / 2 - 0.06, b.y - b.l / 2, b.x - b.w / 2 + 0.06, b.y + b.l / 2, '#fff')
    flat(b.x - b.w / 2, b.y - b.l / 2 - 0.06, b.x + b.w / 2, b.y - b.l / 2 + 0.06, '#fff')
  }
  const last = lot.bays[lot.bays.length - 1]
  flat(last.x + last.w / 2 - 0.06, last.y - last.l / 2, last.x + last.w / 2 + 0.06, last.y + last.l / 2, '#fff')
  const walls = [[-H0.x, -H0.y, H0.x, -H0.y + 0.4], [-H0.x, H0.y - 0.4, H0.x, H0.y], [-H0.x, -H0.y, -H0.x + 0.4, H0.y], [H0.x - 0.4, -H0.y, H0.x, H0.y]]
  const items = walls.map(([x0, y0, x1, y1]) => ({ z: toCamera(cam, (x0 + x1) / 2, (y0 + y1) / 2).z - Math.hypot(x1 - x0, y1 - y0) / 2, wall: [x0, y0, x1, y1] }))
  lot.parked.forEach((o) => items.push({ z: toCamera(cam, o.x, o.y).z, car: o }))
  items.sort((a, b) => b.z - a.z)
  for (const it of items) {
    if (it.wall) { const [x0, y0, x1, y1] = it.wall; drawBox(ctx, cam, (x0 + x1) / 2, (y0 + y1) / 2, 0, x1 - x0, y1 - y0, 0, 0.6, '#9aa3ab') }
    else {
      const o = it.car; const color = CAR_COLORS[o.color % CAR_COLORS.length]
      drawBox(ctx, cam, o.x, o.y, 0, o.w, o.l, 0.25, 0.8, color)
      drawBox(ctx, cam, o.x, o.y + 0.25, 0, o.w * 0.84, o.l * 0.5, 1.05, 0.55, '#38424c')
    }
  }
}

// The rear of your own car, seen from behind.
function drawCarRear(ctx, cam, car) {
  const p = project(cam, car.x, car.y, 0)
  if (!p) return
  const k = p.k
  const w = CAR.width * k
  const h = 1.45 * k
  const lean = (car.steer ?? 0) * 0.03 * w // the body leans a little in a turn
  const x = p.x - w / 2 + lean
  const y = p.y - h
  const body = '#c8202a'
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.6, w * 0.09, 0, 0, Math.PI * 2); ctx.fill()
  // tyres
  ctx.fillStyle = '#0b0c0e'
  ctx.beginPath(); ctx.roundRect(x + w * 0.05, p.y - h * 0.3, w * 0.17, h * 0.3, w * 0.03); ctx.roundRect(x + w * 0.78, p.y - h * 0.3, w * 0.17, h * 0.3, w * 0.03); ctx.fill()
  // lower body and bumper
  const lower = ctx.createLinearGradient(0, y + h * 0.4, 0, y + h * 0.95)
  lower.addColorStop(0, shade(body, 1.2)); lower.addColorStop(1, shade(body, 0.6))
  ctx.fillStyle = lower
  ctx.beginPath(); ctx.roundRect(x, y + h * 0.4, w, h * 0.5, [w * 0.07, w * 0.07, w * 0.04, w * 0.04]); ctx.fill()
  ctx.fillStyle = '#1b1d20'
  ctx.beginPath(); ctx.roundRect(x + w * 0.03, y + h * 0.8, w * 0.94, h * 0.14, w * 0.03); ctx.fill()
  // cabin: roof, glass and pillars
  ctx.fillStyle = shade(body, 0.9)
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.42); ctx.lineTo(x + w * 0.2, y + h * 0.02); ctx.quadraticCurveTo(p.x + lean, y - h * 0.03, x + w * 0.8, y + h * 0.02); ctx.lineTo(x + w * 0.9, y + h * 0.42); ctx.closePath(); ctx.fill()
  const glass = ctx.createLinearGradient(0, y + h * 0.08, 0, y + h * 0.4)
  glass.addColorStop(0, '#2b3a47'); glass.addColorStop(1, '#10171d')
  ctx.fillStyle = glass
  ctx.beginPath(); ctx.moveTo(x + w * 0.16, y + h * 0.4); ctx.lineTo(x + w * 0.24, y + h * 0.1); ctx.lineTo(x + w * 0.76, y + h * 0.1); ctx.lineTo(x + w * 0.84, y + h * 0.4); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.16)'
  ctx.beginPath(); ctx.moveTo(x + w * 0.27, y + h * 0.12); ctx.lineTo(x + w * 0.42, y + h * 0.12); ctx.lineTo(x + w * 0.32, y + h * 0.38); ctx.lineTo(x + w * 0.2, y + h * 0.38); ctx.closePath(); ctx.fill()
  // L plate on the glass
  ctx.fillStyle = '#fff'; ctx.fillRect(p.x + lean - w * 0.07, y + h * 0.17, w * 0.14, w * 0.14)
  ctx.fillStyle = '#c8202a'; ctx.font = `bold ${Math.max(7, w * 0.11)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('L', p.x + lean, y + h * 0.17 + w * 0.115)
  // boot lid line and number plate
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(1, w * 0.01)
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.46); ctx.lineTo(x + w * 0.9, y + h * 0.46); ctx.stroke()
  ctx.fillStyle = '#f5f5f0'; ctx.beginPath(); ctx.roundRect(p.x + lean - w * 0.15, y + h * 0.66, w * 0.3, h * 0.11, w * 0.01); ctx.fill()
  // tail lights wrap round the corners
  const lit = car.braking
  ctx.fillStyle = lit ? '#ff3030' : '#a01818'
  for (const [lx, flip] of [[x + w * 0.03, 1], [x + w * 0.97, -1]]) {
    ctx.beginPath(); ctx.moveTo(lx, y + h * 0.5); ctx.lineTo(lx + flip * w * 0.27, y + h * 0.52); ctx.lineTo(lx + flip * w * 0.24, y + h * 0.63); ctx.lineTo(lx, y + h * 0.65); ctx.closePath(); ctx.fill()
  }
  if (lit) { ctx.fillStyle = 'rgba(255, 60, 60, .3)'; ctx.beginPath(); ctx.arc(x + w * 0.14, y + h * 0.58, w * 0.2, 0, Math.PI * 2); ctx.arc(x + w * 0.86, y + h * 0.58, w * 0.2, 0, Math.PI * 2); ctx.fill() }
}

// The view from the driver's seat: bonnet, dashboard and a steering wheel that turns with the car.
function drawCockpit(ctx, W, H, car, wheel) {
  ctx.fillStyle = '#9c161b' // bonnet
  ctx.beginPath(); ctx.moveTo(W * 0.2, H); ctx.lineTo(W * 0.34, H * 0.8); ctx.lineTo(W * 0.66, H * 0.8); ctx.lineTo(W * 0.8, H); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.12)'
  ctx.beginPath(); ctx.moveTo(W * 0.4, H * 0.8); ctx.lineTo(W * 0.46, H * 0.8); ctx.lineTo(W * 0.42, H); ctx.lineTo(W * 0.3, H); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#14181c' // pillars and roof edge
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.1, 0); ctx.lineTo(0, H * 0.55); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.9, 0); ctx.lineTo(W, H * 0.55); ctx.closePath(); ctx.fill()
  ctx.fillRect(0, 0, W, H * 0.05)
  ctx.fillStyle = '#0d1114'; ctx.beginPath(); ctx.roundRect(W * 0.38, H * 0.06, W * 0.24, H * 0.06, 8); ctx.fill() // mirror
  ctx.fillStyle = '#9fb3c4'; ctx.beginPath(); ctx.roundRect(W * 0.395, H * 0.072, W * 0.21, H * 0.036, 5); ctx.fill()
  const dash = ctx.createLinearGradient(0, H * 0.84, 0, H)
  dash.addColorStop(0, '#20262c'); dash.addColorStop(1, '#0b0e11')
  ctx.fillStyle = dash; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H * 0.9); ctx.quadraticCurveTo(W / 2, H * 0.8, W, H * 0.9); ctx.lineTo(W, H); ctx.closePath(); ctx.fill()
  if (wheel) drawWheel(ctx, W / 2, H * 1.02, Math.min(W, H) * 0.3, (car.steer ?? 0) * 1.9)
}

export function drawWheel(ctx, cx, cy, r, angle) {
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(angle)
  ctx.strokeStyle = '#0a0c0e'; ctx.lineWidth = r * 0.17
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#2d343b'; ctx.lineWidth = r * 0.09
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#0a0c0e'; ctx.lineWidth = r * 0.14
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, 0); ctx.lineTo(0, r); ctx.stroke()
  ctx.fillStyle = '#b91c22'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffc400'; ctx.fillRect(-r * 0.04, -r * 1.07, r * 0.08, r * 0.16) // top mark: shows how far the wheel is turned
  ctx.restore()
}
