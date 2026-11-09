// A simple perspective camera for the 3D views. World units are metres; world height z is up.
// The camera looks along the car's heading, so a point straight ahead lands in the middle of the screen.

const NEAR = 0.4

export const VIEWS = ['top', 'chase', 'cockpit']
export const VIEW_LABEL = { top: 'Top view', chase: 'Behind the car', cockpit: 'Driver view' }

export function makeCamera(view, car, W, H) {
  const s = Math.sin(car.heading)
  const c = Math.cos(car.heading)
  const back = view === 'chase' ? 7.5 : -0.3 // the driver sits a little ahead of the car's middle
  return {
    x: car.x - s * back, y: car.y + c * back, heading: car.heading,
    height: view === 'chase' ? 3.3 : 1.25,
    horizon: H * (view === 'chase' ? 0.4 : 0.46),
    focal: Math.min(W, H * 1.15) * (view === 'chase' ? 0.95 : 0.85), // a wide, short screen (a phone on its side) must not zoom in
    W, H, s, c,
  }
}

// Distance ahead (z) and to the right (r) of the camera, for a world point.
export function toCamera(cam, wx, wy) {
  const dx = wx - cam.x
  const dy = wy - cam.y
  return { z: dx * cam.s - dy * cam.c, r: dx * cam.c + dy * cam.s }
}

// A world point at height wz on the screen, or null if it is behind the camera.
export function project(cam, wx, wy, wz = 0) {
  const { z, r } = toCamera(cam, wx, wy)
  if (z < NEAR) return null
  const k = cam.focal / z
  return { x: cam.W / 2 + r * k, y: cam.horizon + (cam.height - wz) * k, z, k }
}

// A flat or upright polygon given as [x, y, z] points, cut at the near plane and projected.
// Returns screen points, or null when nothing of it is in front of the camera.
export function projectPoly(cam, pts) {
  const cs = pts.map(([x, y, wz]) => ({ ...toCamera(cam, x, y), h: wz }))
  const out = []
  for (let i = 0; i < cs.length; i += 1) {
    const a = cs[i]
    const b = cs[(i + 1) % cs.length]
    const aIn = a.z >= NEAR
    if (aIn) out.push(a)
    if (aIn !== (b.z >= NEAR)) {
      const t = (NEAR - a.z) / (b.z - a.z)
      out.push({ z: NEAR, r: a.r + (b.r - a.r) * t, h: a.h + (b.h - a.h) * t })
    }
  }
  if (out.length < 3) return null
  return out.map((p) => { const k = cam.focal / p.z; return { x: cam.W / 2 + p.r * k, y: cam.horizon + (cam.height - p.h) * k } })
}
