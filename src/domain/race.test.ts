import { describe, expect, it } from 'vitest'
import {
  createHorses,
  createRacePlan,
  createSchedule,
  getPositions,
  getRaceResult,
  HORSE_COUNT,
  HORSES_PER_ROUND,
  ROUND_DISTANCES,
  type RacePlan,
} from './race'

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 2 ** 32
  }
}

describe('horse roster and schedule', () => {
  it('creates 20 identifiable horses with unique names and colors', () => {
    const horses = createHorses(seededRandom(42))
    expect(horses).toHaveLength(HORSE_COUNT)
    for (const field of ['id', 'name', 'color'] as const) {
      expect(new Set(horses.map((horse) => horse[field])).size).toBe(HORSE_COUNT)
    }
    expect(
      horses.every(
        (horse) =>
          Number.isInteger(horse.condition) && horse.condition >= 1 && horse.condition <= 100,
      ),
    ).toBe(true)
  })

  it('includes both condition boundaries without generating 0 or 101', () => {
    expect(createHorses(() => 0).every((horse) => horse.condition === 1)).toBe(true)
    expect(createHorses(() => 0.999999).every((horse) => horse.condition === 100)).toBe(true)
  })

  it('samples ten distinct available horses for each of the six required distances', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const horses = createHorses(seededRandom(seed))
      const before = structuredClone(horses)
      const rounds = createSchedule(horses, seededRandom(seed + 100))
      expect(rounds.map((round) => round.distance)).toEqual(ROUND_DISTANCES)
      expect(rounds.map((round) => round.id)).toEqual([1, 2, 3, 4, 5, 6])
      for (const round of rounds) {
        expect(round.horseIds).toHaveLength(HORSES_PER_ROUND)
        expect(new Set(round.horseIds).size).toBe(HORSES_PER_ROUND)
        expect(round.horseIds.every((id) => horses.some((horse) => horse.id === id))).toBe(true)
      }
      expect(horses).toEqual(before)
    }
  })

  it('produces different programs from different random seeds', () => {
    const horses = createHorses(() => 0.5)
    expect(createSchedule(horses, seededRandom(1))).not.toEqual(
      createSchedule(horses, seededRandom(2)),
    )
  })

  it('rejects incomplete or duplicate rosters', () => {
    const horses = createHorses()
    expect(() => createSchedule(horses.slice(0, 19))).toThrow('20 distinct horses')
    expect(() => createSchedule(Array(20).fill(horses[0]))).toThrow('20 distinct horses')
  })
})

describe('race simulation', () => {
  const horses = createHorses(() => 0.5)
  const round = createSchedule(horses, () => 0.5)[0]!

  it('gives better-conditioned horses faster expected finish times under equal form', () => {
    const low = horses.map((horse) => ({ ...horse, condition: 1 }))
    const high = horses.map((horse) => ({ ...horse, condition: 100 }))
    const slower = createRacePlan(round, low, () => 0.5)
    const faster = createRacePlan(round, high, () => 0.5)
    expect(
      faster.runners.every(
        (runner, index) => runner.finishTime < slower.runners[index]!.finishTime,
      ),
    ).toBe(true)
  })

  it('includes race-day variation for horses with the same condition', () => {
    const plan = createRacePlan(round, horses, seededRandom(55))
    expect(new Set(plan.runners.map((runner) => runner.finishTime)).size).toBe(10)
  })

  it('starts at zero, never moves backwards, and stops exactly at the finish', () => {
    const plan = createRacePlan(round, horses, seededRandom(7))
    let previous = getPositions(plan, -1)
    expect(Object.values(previous).every((position) => position === 0)).toBe(true)
    for (let time = 0; time <= plan.duration + 1; time += 0.1) {
      const positions = getPositions(plan, time)
      for (const [horseId, position] of Object.entries(positions)) {
        expect(position).toBeGreaterThanOrEqual(previous[horseId]!)
        expect(position).toBeGreaterThanOrEqual(0)
        expect(position).toBeLessThanOrEqual(100)
      }
      previous = positions
    }
    expect(
      Object.values(getPositions(plan, plan.duration)).every((position) => position === 100),
    ).toBe(true)
  })

  it('sorts by exact finish time, with starting-lane order for exact ties', () => {
    const plan: RacePlan = {
      roundId: 1,
      distance: 1200,
      duration: 80,
      runners: [
        { horseId: 'late', finishTime: 80, paceBias: 0 },
        { horseId: 'tie-a', finishTime: 60, paceBias: 0.03 },
        { horseId: 'tie-b', finishTime: 60, paceBias: -0.03 },
        { horseId: 'first', finishTime: 59.999, paceBias: 0 },
      ],
    }
    const result = getRaceResult(plan)
    expect(result.entries.map((entry) => entry.horseId)).toEqual([
      'first',
      'tie-a',
      'tie-b',
      'late',
    ])
    expect(result.entries.map((entry) => entry.position)).toEqual([1, 2, 3, 4])
    expect(result.entries[0]!.time).toBe(59.999)
    expect(plan.runners[0]!.horseId).toBe('late')
  })

  it('puts each horse exactly at 100% at its own finish time, never just before', () => {
    const plan = createRacePlan(round, horses, seededRandom(91))
    for (const runner of plan.runners) {
      expect(getPositions(plan, runner.finishTime)[runner.horseId]).toBe(100)
      expect(getPositions(plan, runner.finishTime + 1)[runner.horseId]).toBe(100)
      expect(getPositions(plan, runner.finishTime - 0.000001)[runner.horseId]).toBeLessThan(100)
    }
  })

  it('rejects malformed participants rather than silently creating an invalid race', () => {
    expect(() =>
      createRacePlan({ ...round, horseIds: ['unknown', ...round.horseIds.slice(1)] }, horses),
    ).toThrow('Unknown horse')
    expect(() =>
      createRacePlan({ ...round, horseIds: Array(10).fill(round.horseIds[0]) }, horses),
    ).toThrow('10 distinct horses')
  })
})
