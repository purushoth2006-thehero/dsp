// The rules of the car game, with no React or canvas, so they are easy to test.
// The road has 3 lanes. Positions are fractions of the screen: y = 0 is the top, y = 1 the bottom.

export const LANES = 3
export const PLAYER_Y = 0.8
export const CAR_H = 0.15 // car length as a fraction of the road height
const START_SPEED = 0.45 // road heights per second
const MAX_SPEED = 1.15
const MIN_GAP = 0.32 // closest two cars may spawn, so there is always time to change lane

export const newGame = () => ({ lane: 1, enemies: [], distance: 0, speed: START_SPEED, lastSpawnY: 1, over: false })

export const moveLane = (g, dir) => (g.over ? g : { ...g, lane: Math.min(LANES - 1, Math.max(0, g.lane + dir)) })

// Advances the game by dt seconds. rng() returns a number in [0, 1).
export function step(g, dt, rng = Math.random) {
  if (g.over) return g
  const speed = Math.min(MAX_SPEED, g.speed + dt * 0.012)
  let enemies = g.enemies.map((e) => ({ ...e, y: e.y + speed * dt })).filter((e) => e.y < 1.2)
  let lastSpawnY = g.lastSpawnY + speed * dt

  // One car at a time, spread out: three lanes can never be blocked together.
  if (lastSpawnY > MIN_GAP + rng() * 0.2) {
    enemies = [...enemies, { lane: Math.floor(rng() * LANES), y: -CAR_H, color: Math.floor(rng() * 5) }]
    lastSpawnY = 0
  }

  const hit = enemies.some((e) => e.lane === g.lane && Math.abs(e.y - PLAYER_Y) < CAR_H * 0.9)
  return { ...g, enemies, speed, lastSpawnY, distance: g.distance + speed * dt, over: hit }
}

// The score shown to the player: metres driven.
export const scoreOf = (g) => Math.floor(g.distance * 100)
