export interface Horse {
  id: string
  name: string
  color: string
  condition: number
}

export interface RaceRound {
  id: number
  distance: number
  horseIds: string[]
}

export interface RaceResult {
  roundId: number
  distance: number
  entries: { horseId: string; position: number; time: number }[]
}

export interface RacePlan {
  roundId: number
  distance: number
  duration: number
  runners: { horseId: string; finishTime: number; paceBias: number }[]
}

export type RandomSource = () => number

export const HORSE_COUNT = 20
export const HORSES_PER_ROUND = 10
export const ROUND_DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200] as const
export const SIMULATION_SPEED = 8

const HORSE_NAMES = [
  'Amber Comet',
  'Silver Arrow',
  'Midnight Echo',
  'Wild Juniper',
  'Copper Crown',
  'Velvet Thunder',
  'Golden Hour',
  'Blue Horizon',
  'Scarlet Wind',
  'Lucky Clover',
  'Moonlit Dancer',
  'Desert Rose',
  'Quiet Storm',
  'Royal Fern',
  'Morning Glory',
  'Rusty Rocket',
  'Indigo Dream',
  'Summer Solstice',
  'Pearl Runner',
  'Maple Spirit',
] as const

const HORSE_COLORS = [
  '#ca6926',
  '#64748b',
  '#4338ca',
  '#15803d',
  '#9a3412',
  '#7e22ce',
  '#a16207',
  '#0284c7',
  '#dc2626',
  '#65a30d',
  '#a855f7',
  '#db2777',
  '#334155',
  '#0f766e',
  '#c026d3',
  '#ea580c',
  '#2563eb',
  '#ca8a04',
  '#0891b2',
  '#be123c',
] as const

function sample(random: RandomSource): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(
      'A random source must return a number from 0 (inclusive) to 1 (exclusive).',
    )
  }
  return value
}

export function createHorses(random: RandomSource = Math.random): Horse[] {
  return HORSE_NAMES.map((name, index) => ({
    id: `horse-${index + 1}`,
    name,
    color: HORSE_COLORS[index]!,
    condition: Math.floor(sample(random) * 100) + 1,
  }))
}

export function createSchedule(horses: Horse[], random: RandomSource = Math.random): RaceRound[] {
  if (
    horses.length !== HORSE_COUNT ||
    new Set(horses.map((horse) => horse.id)).size !== HORSE_COUNT
  ) {
    throw new Error('A race program requires 20 distinct horses.')
  }

  return ROUND_DISTANCES.map((distance, index) => {
    const horseIds = horses.map((horse) => horse.id)
    // Fisher–Yates gives each horse an equal chance without changing the roster.
    for (let i = horseIds.length - 1; i > 0; i--) {
      const j = Math.floor(sample(random) * (i + 1))
      ;[horseIds[i], horseIds[j]] = [horseIds[j]!, horseIds[i]!]
    }
    return {
      id: index + 1,
      distance,
      horseIds: horseIds.slice(0, HORSES_PER_ROUND),
    }
  })
}

export function createRacePlan(
  round: RaceRound,
  horses: Horse[],
  random: RandomSource = Math.random,
): RacePlan {
  if (!Number.isFinite(round.distance) || round.distance <= 0) {
    throw new Error('Race distance must be positive.')
  }
  if (
    round.horseIds.length !== HORSES_PER_ROUND ||
    new Set(round.horseIds).size !== HORSES_PER_ROUND
  ) {
    throw new Error('Each round requires 10 distinct horses.')
  }

  const roster = new Map(horses.map((horse) => [horse.id, horse]))
  const runners = round.horseIds.map((horseId) => {
    const horse = roster.get(horseId)
    if (!horse) throw new Error(`Unknown horse: ${horseId}`)
    if (!Number.isInteger(horse.condition) || horse.condition < 1 || horse.condition > 100) {
      throw new Error('Horse condition must be an integer from 1 to 100.')
    }
    // Condition improves expected speed, while race-day form keeps outcomes uncertain.
    const metersPerSecond = 14 + horse.condition * 0.06 + sample(random) * 5
    return {
      horseId,
      finishTime: round.distance / metersPerSecond,
      paceBias: (sample(random) - 0.5) * 0.12,
    }
  })

  return {
    roundId: round.id,
    distance: round.distance,
    duration: Math.max(...runners.map((runner) => runner.finishTime)),
    runners,
  }
}

/** Positions are percentages. Pacing varies continuously without ever moving backwards. */
export function getPositions(plan: RacePlan, elapsedSeconds: number): Record<string, number> {
  return Object.fromEntries(
    plan.runners.map((runner) => {
      if (elapsedSeconds <= 0) return [runner.horseId, 0]
      if (elapsedSeconds >= runner.finishTime) return [runner.horseId, 100]
      const fraction = elapsedSeconds / runner.finishTime
      const paced = fraction + runner.paceBias * Math.sin(2 * Math.PI * fraction)
      return [runner.horseId, Math.min(100, Math.max(0, paced * 100))]
    }),
  )
}

export function getRaceResult(plan: RacePlan): RaceResult {
  return {
    roundId: plan.roundId,
    distance: plan.distance,
    // Stable sorting breaks exact ties by starting lane, making the outcome reproducible.
    entries: [...plan.runners]
      .sort((a, b) => a.finishTime - b.finishTime)
      .map((runner, index) => ({
        horseId: runner.horseId,
        position: index + 1,
        time: runner.finishTime,
      })),
  }
}
