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

import { BARRIER, GEAR_TOP, LOT_HALF, WEATHER, buildLot, corners, newParkingRun, overlap, parkingScore, stepParking } from './drive.js'
import { makeCamera, project, projectPoly } from './camera.js'

describe('weather and free driving', () => {
  it('has less grip in the rain', () => {
    const dry = drive({ ...newCar(), v: 25 }, { steer: 1 }, 1)
    let wet = { ...newCar(), v: 25 }
    for (let i = 0; i < 60; i += 1) wet = stepCar(wet, { steer: 1 }, 1 / 60, false, WEATHER.rain.grip)
    expect(wet.heading).toBeLessThan(dry.heading)
  })

  it('free driving never finishes a lap or counts speeding', () => {
    const track = buildTrack()
    let run = { ...newRun(track), started: true, next: track.checkpoints }
    const p = track.pts[0]
    run = stepRun({ ...run, car: { ...run.car, x: p.x, y: p.y, v: 30 } }, track, { throttle: 1 }, 0.1, { free: true })
    expect(run.finished).toBe(false)
    expect(run.speedingTime).toBe(0)
  })
})

describe('reverse parking', () => {
  const lot = buildLot()
  const t = lot.target
  const parked = (over) => ({ ...newParkingRun(lot), started: true, car: { ...newCar(t.x, t.y, Math.PI), ...over } })

  it('has one empty bay between parked cars, inside the lot', () => {
    expect(lot.parked).toHaveLength(lot.bays.length - 1)
    expect(lot.parked.some((o) => Math.abs(o.x - t.x) < 1)).toBe(false)
    expect(Math.abs(t.y) + t.l / 2).toBeLessThanOrEqual(LOT_HALF.y)
    const start = lot.start
    expect(corners(start.x, start.y, start.heading, 1.9, 4.2).every((c) => Math.abs(c.x) < LOT_HALF.x && Math.abs(c.y) < LOT_HALF.y)).toBe(true)
  })

  it('detects overlapping and separate rectangles', () => {
    const a = corners(0, 0, 0, 2, 4)
    expect(overlap(a, corners(1, 1, 0.5, 2, 4))).toBe(true)
    expect(overlap(a, corners(10, 0, 0, 2, 4))).toBe(false)
  })

  it('finishes when backed into the bay, straight and stopped, for a moment', () => {
    let run = parked({})
    for (let i = 0; i < 60; i += 1) run = stepParking(run, lot, {}, 1 / 60)
    expect(run.finished).toBe(true)
    expect(run.hits).toBe(0)
  })

  it('does not count a car that is parked nose first', () => {
    let run = parked({ heading: 0 })
    for (let i = 0; i < 90; i += 1) run = stepParking(run, lot, {}, 1 / 60)
    expect(run.finished).toBe(false)
  })

  it('does not count a car that is crooked or still moving', () => {
    let crooked = parked({ heading: Math.PI + 0.5 })
    for (let i = 0; i < 90; i += 1) crooked = stepParking(crooked, lot, {}, 1 / 60)
    expect(crooked.finished).toBe(false)
  })

  it('stops the car and counts one bump when it touches a parked car', () => {
    const o = lot.parked[0]
    let run = { ...newParkingRun(lot), started: true, car: newCar(o.x, o.y + 2.5, 0) }
    run = stepParking(run, lot, { throttle: 1 }, 1 / 60)
    expect(run.hits).toBe(1)
    expect(run.car.v).toBe(0)
    run = stepParking(run, lot, { throttle: 1 }, 1 / 60)
    expect(run.hits).toBe(1) // the same bump is not counted twice
  })

  it('scores carefully', () => {
    expect(parkingScore({ hits: 0, time: 30 })).toBe(100)
    expect(parkingScore({ hits: 2, time: 55 })).toBe(72)
    expect(parkingScore({ hits: 20, time: 300 })).toBe(0)
  })
})

describe('the 3D camera', () => {
  const W = 400
  const H = 600
  const car = newCar(0, 0, 0)

  it('puts a point straight ahead in the middle, and nearer points lower', () => {
    const cam = makeCamera('chase', car, W, H)
    const far = project(cam, 0, -40)
    const near = project(cam, 0, -12)
    expect(far.x).toBeCloseTo(W / 2, 3)
    expect(near.y).toBeGreaterThan(far.y)
    expect(far.y).toBeGreaterThan(cam.horizon)
  })

  it('puts the right-hand side on the right, whichever way the car faces', () => {
    for (const heading of [0, 1, 2.5]) {
      const c = newCar(5, 5, heading)
      const cam = makeCamera('cockpit', c, W, H)
      const rightOfCar = project(cam, c.x + Math.cos(heading) * 2 + Math.sin(heading) * 20, c.y + Math.sin(heading) * 2 - Math.cos(heading) * 20)
      expect(rightOfCar.x).toBeGreaterThan(W / 2)
    }
  })

  it('hides points behind the camera and cuts polygons at the near plane', () => {
    const cam = makeCamera('cockpit', car, W, H)
    expect(project(cam, 0, 10)).toBeNull()
    const strip = projectPoly(cam, [[-3, 5, 0], [3, 5, 0], [3, -30, 0], [-3, -30, 0]]) // starts behind the camera
    expect(strip).not.toBeNull()
    expect(strip.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(projectPoly(cam, [[-3, 5, 0], [3, 5, 0], [3, 20, 0], [-3, 20, 0]])).toBeNull()
  })
})

describe('manual gears', () => {
  const run = (gear, seconds, throttle = 1, car = newCar()) => {
    let c = car
    for (let i = 0; i < seconds * 60; i += 1) c = stepCar(c, { throttle, brake: 0, steer: 0, gear }, 1 / 60)
    return c
  }
  it('neutral does not move the car', () => { expect(run(0, 3).v).toBe(0) })
  it('each gear runs out of speed at its top', () => {
    expect(run(1, 20).v).toBeLessThan(GEAR_TOP[1] + 0.1)
    expect(run(1, 20).v).toBeGreaterThan(GEAR_TOP[1] * 0.9)
    expect(run(5, 60, 1, { ...newCar(), v: 20 }).v).toBeGreaterThan(run(1, 60).v)
  })
  it('a high gear is slow to get going', () => { expect(run(5, 3).v).toBeLessThan(run(1, 3).v) })
  it('reverse goes backwards and the brake never reverses the car', () => {
    expect(run(-1, 3).v).toBeLessThan(-1)
    let c = newCar()
    for (let i = 0; i < 120; i += 1) c = stepCar(c, { throttle: 0, brake: 1, steer: 0, gear: 1 }, 1 / 60)
    expect(c.v).toBe(0)
  })
  it('too high a speed for the gear slows the car down', () => {
    expect(run(1, 3, 1, { ...newCar(), v: 20 }).v).toBeLessThan(15)
  })
})

describe('the fence', () => {
  it('stops the car beyond the grass and slows it down', () => {
    const track = buildTrack()
    let run = newRun(track)
    run.car = { ...run.car, heading: run.car.heading + Math.PI / 2, v: 15 } // drive straight off the road
    for (let i = 0; i < 600; i += 1) run = stepRun(run, track, { throttle: 1, brake: 0, steer: 0 }, 1 / 60)
    expect(nearest(track, run.car.x, run.car.y).dist).toBeLessThanOrEqual(BARRIER + 0.01)
    expect(run.fences).toBeGreaterThanOrEqual(1)
    expect(Math.abs(run.car.v)).toBeLessThan(10)
  })
})
