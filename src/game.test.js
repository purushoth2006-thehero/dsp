import { describe, expect, it } from 'vitest'
import { CAR_H, LANES, PLAYER_Y, moveLane, newGame, scoreOf, step } from './game.js'

// A repeatable "random" sequence for the tests.
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

describe('car game', () => {
  it('keeps the car inside the lanes', () => {
    let g = newGame()
    for (let i = 0; i < 5; i += 1) g = moveLane(g, -1)
    expect(g.lane).toBe(0)
    for (let i = 0; i < 5; i += 1) g = moveLane(g, 1)
    expect(g.lane).toBe(LANES - 1)
  })

  it('crashes when a car reaches yours in the same lane', () => {
    const g = { ...newGame(), lane: 1, enemies: [{ lane: 1, y: PLAYER_Y - CAR_H * 0.5, color: 0 }], lastSpawnY: 0 }
    expect(step(g, 0.01, () => 0.5).over).toBe(true)
  })

  it('does not crash when the car is in another lane', () => {
    const g = { ...newGame(), lane: 0, enemies: [{ lane: 2, y: PLAYER_Y, color: 0 }], lastSpawnY: 0 }
    expect(step(g, 0.01, () => 0.5).over).toBe(false)
  })

  it('never blocks every lane at once, and scores distance', () => {
    const rng = seeded()
    let g = newGame()
    for (let i = 0; i < 4000; i += 1) {
      g = { ...step({ ...g, over: false }, 1 / 60, rng), over: false } // ignore crashes: only the traffic pattern is checked
      for (const e of g.enemies) {
        const abreast = new Set(g.enemies.filter((o) => Math.abs(o.y - e.y) < CAR_H).map((o) => o.lane))
        expect(abreast.size).toBeLessThan(LANES)
      }
    }
    expect(scoreOf(g)).toBeGreaterThan(1000)
  })
})
