import { describe, expect, it } from 'vitest'
import { CAR, MAX_SPEED, ROAD_HALF, SPEED_LIMIT, buildTrack, drivingScore, kmh, nearest, newCar, newRun, stepCar, stepRun } from './drive.js'

const drive = (car, inp, seconds, offroad = false) => {
  let c = car
  for (let i = 0; i < seconds * 60; i += 1) c = stepCar(c, inp, 1 / 60, offroad)
  return c
}

describe('the car', () => {
  it('speeds up with the throttle but never beyond the top speed', () => {
    const c = drive(newCar(), { throttle: 1 }, 30)
    expect(c.v).toBeGreaterThan(20)
    expect(c.v).toBeLessThanOrEqual(MAX_SPEED)
    expect(c.y).toBeLessThan(0) // heading 0 drives up the screen
  })

  it('brakes to a stop and does not roll backwards', () => {
    const fast = drive(newCar(), { throttle: 1 }, 6)
    const braked = drive(fast, { brake: 1 }, (fast.v / 15) * 0.9)
    expect(braked.v).toBeGreaterThanOrEqual(0)
    expect(braked.v).toBeLessThan(fast.v / 3)
    expect(drive(fast, {}, 60).v).toBe(0) // coasting also ends at a standstill
  })

  it('reverses when you keep braking at a standstill', () => {
    const c = drive(newCar(), { brake: 1 }, 3)
    expect(c.v).toBeLessThan(-1)
    expect(c.y).toBeGreaterThan(0)
  })

  it('turns only while moving, and right means clockwise', () => {
    expect(drive(newCar(), { steer: 1 }, 2).heading).toBe(0)
    const c = drive(newCar(), { throttle: 1, steer: 1 }, 3)
    expect(c.heading).toBeGreaterThan(0.1)
    expect(c.x).toBeGreaterThan(0)
  })

  it('turns less sharply at high speed', () => {
    const slow = drive({ ...newCar(), v: 6 }, { steer: 1 }, 1)
    const fast = drive({ ...newCar(), v: 30 }, { steer: 1 }, 1)
    expect(fast.heading / 30).toBeLessThan(slow.heading / 6)
  })

  it('slows down on the grass', () => {
    const road = drive(newCar(), { throttle: 1 }, 10)
    const grass = drive(newCar(), { throttle: 1 }, 10, true)
    expect(grass.v).toBeLessThan(road.v * 0.6)
  })
})

describe('the track', () => {
  const track = buildTrack()

  it('is a closed road with the car starting on it', () => {
    expect(track.n).toBeGreaterThan(150)
    expect(nearest(track, track.start.x, track.start.y).dist).toBeLessThan(0.5)
    expect(nearest(track, track.pts[40].x + 50, track.pts[40].y + 50).dist).toBeGreaterThan(ROAD_HALF)
  })

  it('keeps cones on the road and bushes off it', () => {
    for (const c of track.cones) expect(nearest(track, c.x, c.y).dist).toBeLessThan(ROAD_HALF)
    for (const b of track.bushes) expect(nearest(track, b.x, b.y).dist).toBeGreaterThan(ROAD_HALF)
  })

  it('finishes a lap only after every checkpoint, in order', () => {
    let run = newRun(track)
    run = { ...run, started: true }
    const visited = []
    for (let i = 0; i <= track.n + 6; i += 2) {
      const p = track.pts[i % track.n]
      run = stepRun({ ...run, car: { ...run.car, x: p.x, y: p.y } }, track, { throttle: 0 }, 0.01)
      visited.push(run.next)
      if (run.finished) break
    }
    expect(run.finished).toBe(true)
    // Skipping straight to the end does not count.
    let cheat = { ...newRun(track), started: true }
    const end = track.pts[0]
    cheat = stepRun({ ...cheat, car: { ...cheat.car, x: end.x, y: end.y } }, track, { throttle: 0 }, 0.01)
    expect(cheat.finished).toBe(false)
  })

  it('knocks over a cone you drive into, and scores careful driving', () => {
    const cone = track.cones[0]
    const run = { ...newRun(track), started: true, car: newCar(cone.x, cone.y, 0) }
    const next = stepRun(run, track, { throttle: 0 }, 0.01)
    expect(next.hit).toContain(0)
    expect(drivingScore({ hit: [0, 1], offroadTime: 2, speedingTime: 4 })).toBe(100 - 10 - 6 - 6)
    expect(drivingScore({ hit: new Array(30).fill(0), offroadTime: 0, speedingTime: 0 })).toBe(0)
    expect(kmh(SPEED_LIMIT)).toBe(60)
    expect(CAR.length).toBeGreaterThan(CAR.width)
  })
})
