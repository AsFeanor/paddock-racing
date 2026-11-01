import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIMULATION_SPEED } from '../domain/race'
import { useRaceStore } from './race'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

function runningRace() {
  const race = useRaceStore()
  race.generateProgram()
  race.start()
  return race
}

describe('race lifecycle', () => {
  it('starts with a roster but cannot race until a program has been generated', () => {
    const race = useRaceStore()
    expect(race.status).toBe('idle')
    expect(race.horses).toHaveLength(20)
    expect(race.totalRounds).toBe(6)
    race.start()
    race.tick(1000)
    expect(race.status).toBe('idle')
    expect(race.results).toEqual([])
    race.generateProgram()
    expect(race.status).toBe('ready')
    expect(race.currentHorses).toHaveLength(10)
    expect(race.currentRound?.distance).toBe(1200)
  })

  it('pauses immediately and resumes the same plan and elapsed time', () => {
    const race = runningRace()
    race.tick(2)
    const positions = { ...race.positions }
    const plan = JSON.stringify(race.racePlans)
    race.pause()
    race.tick(1000)
    expect(race.elapsedSeconds).toBe(2 * SIMULATION_SPEED)
    expect(race.positions).toEqual(positions)
    expect(race.results).toHaveLength(0)
    race.resume()
    race.tick(1)
    expect(race.elapsedSeconds).toBe(3 * SIMULATION_SPEED)
    expect(JSON.stringify(race.racePlans)).toBe(plan)
  })

  it('does not regenerate or restart an active or paused program', () => {
    const race = runningRace()
    race.tick(1)
    const schedule = JSON.stringify(race.schedule)
    const plan = JSON.stringify(race.racePlans)
    race.generateProgram()
    race.start()
    expect(JSON.stringify(race.schedule)).toBe(schedule)
    expect(JSON.stringify(race.racePlans)).toBe(plan)
    expect(race.elapsedSeconds).toBe(SIMULATION_SPEED)
    race.pause()
    race.generateProgram()
    race.start()
    expect(race.status).toBe('paused')
    expect(JSON.stringify(race.schedule)).toBe(schedule)
  })

  it('publishes results only after every horse has crossed and advances in order', () => {
    const race = runningRace()
    const duration = race.racePlans[0]!.duration
    race.tick((duration - 1) / SIMULATION_SPEED)
    expect(race.results).toHaveLength(0)
    expect(race.currentRoundIndex).toBe(0)
    race.tick(2 / SIMULATION_SPEED)
    expect(race.results).toHaveLength(1)
    expect(race.results[0]!.roundId).toBe(1)
    expect(race.results[0]!.entries).toHaveLength(10)
    expect(race.currentRoundIndex).toBe(1)
    expect(race.elapsedSeconds).toBeCloseTo(1)
  })

  it('handles a large frame across all six rounds without losing or duplicating results', () => {
    const race = runningRace()
    race.tick(1000)
    expect(race.status).toBe('finished')
    expect(race.results.map((result) => result.roundId)).toEqual([1, 2, 3, 4, 5, 6])
    expect(race.completedRounds).toBe(6)
    expect(race.currentRoundIndex).toBe(5)
    expect(Object.values(race.positions).every((position) => position === 100)).toBe(true)
    expect(race.leader?.id).toBe(race.results[5]!.entries[0]!.horseId)
    race.tick(1000)
    race.start()
    race.resume()
    expect(race.results).toHaveLength(6)
    expect(race.status).toBe('finished')
  })

  it('keeps the earliest finisher as leader when multiple horses have crossed', () => {
    const race = runningRace()
    const plan = race.racePlans[0]!
    plan.runners.forEach((runner) => {
      runner.finishTime = 60
    })
    plan.runners[0]!.finishTime = 50
    plan.runners[1]!.finishTime = 40
    plan.duration = 60
    const winner = plan.runners[1]!.horseId

    race.tick(45 / SIMULATION_SPEED)
    expect(race.leader?.id).toBe(winner)
    race.tick(10 / SIMULATION_SPEED)
    expect(race.positions[plan.runners[0]!.horseId]).toBe(100)
    expect(race.positions[winner]).toBe(100)
    expect(race.results).toHaveLength(0)
    expect(race.status).toBe('running')
    expect(race.leader?.id).toBe(winner)
  })

  it('produces identical results and positions with large or small frame steps', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const largeSteps = runningRace()
    largeSteps.tick(37)
    const expected = {
      results: JSON.parse(JSON.stringify(largeSteps.results)),
      positions: { ...largeSteps.positions },
      round: largeSteps.currentRoundIndex,
      elapsed: largeSteps.elapsedSeconds,
    }
    setActivePinia(createPinia())
    const smallSteps = runningRace()
    for (let frame = 0; frame < 370; frame++) smallSteps.tick(0.1)
    expect(smallSteps.results).toEqual(expected.results)
    expect(smallSteps.currentRoundIndex).toBe(expected.round)
    expect(smallSteps.elapsedSeconds).toBeCloseTo(expected.elapsed, 8)
    for (const [id, position] of Object.entries(expected.positions)) {
      expect(smallSteps.positions[id]).toBeCloseTo(position, 8)
    }
  })

  it('clears old results and timing when generating a fresh program, preserving horses', () => {
    const race = runningRace()
    const horses = JSON.stringify(race.horses)
    race.tick(1000)
    race.generateProgram()
    expect(race.status).toBe('ready')
    expect(race.results).toEqual([])
    expect(race.racePlans).toEqual([])
    expect(race.elapsedSeconds).toBe(0)
    expect(race.currentRoundIndex).toBe(0)
    expect(race.positions).toEqual({})
    expect(JSON.stringify(race.horses)).toBe(horses)
  })

  it('resets to the existing program and allows a complete new run', () => {
    const race = runningRace()
    race.tick(20)
    const schedule = JSON.stringify(race.schedule)
    race.reset()
    expect(race.status).toBe('ready')
    expect(race.results).toEqual([])
    expect(race.elapsedSeconds).toBe(0)
    expect(JSON.stringify(race.schedule)).toBe(schedule)
    race.start()
    race.tick(1000)
    expect(race.results).toHaveLength(6)
  })

  it('ignores invalid time deltas', () => {
    const race = runningRace()
    for (const delta of [-1, 0, NaN, Infinity, Number.MAX_VALUE]) race.tick(delta)
    expect(race.elapsedSeconds).toBe(0)
    expect(race.results).toHaveLength(0)
    expect(race.status).toBe('running')
  })
})
