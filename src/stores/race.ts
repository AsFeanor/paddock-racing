import { defineStore } from 'pinia'
import {
  createHorses,
  createRacePlan,
  createSchedule,
  getPositions,
  getRaceResult,
  ROUND_DISTANCES,
  SIMULATION_SPEED,
  type Horse,
  type RacePlan,
  type RaceResult,
  type RaceRound,
} from '../domain/race'

export type RaceStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished'

export const useRaceStore = defineStore('race', {
  state: () => ({
    horses: createHorses(),
    schedule: [] as RaceRound[],
    results: [] as RaceResult[],
    status: 'idle' as RaceStatus,
    currentRoundIndex: 0,
    elapsedSeconds: 0,
    racePlans: [] as RacePlan[],
  }),

  getters: {
    currentRound: (state): RaceRound | undefined => state.schedule[state.currentRoundIndex],
    currentHorses(): Horse[] {
      const roster = new Map(this.horses.map((horse) => [horse.id, horse]))
      return this.currentRound?.horseIds.map((id) => roster.get(id)!).filter(Boolean) ?? []
    },
    positions(state): Record<string, number> {
      const plan = state.racePlans[state.currentRoundIndex]
      return plan ? getPositions(plan, state.elapsedSeconds) : {}
    },
    leader(): Horse | undefined {
      const plan = this.racePlans[this.currentRoundIndex]
      if (!plan) return undefined
      const result = this.results.find((item) => item.roundId === this.currentRound?.id)
      if (result) return this.horses.find((horse) => horse.id === result.entries[0]?.horseId)
      // Several horses can be at 100% while the remaining runners are still racing.
      // Keep the first finisher in front instead of resolving that visual tie by lane.
      const winner = plan.runners.reduce(
        (first, runner) => (runner.finishTime < first.finishTime ? runner : first),
        plan.runners[0]!,
      )
      if (this.elapsedSeconds >= winner.finishTime) {
        return this.horses.find((horse) => horse.id === winner.horseId)
      }
      const positions = this.positions
      return this.currentHorses.reduce<Horse | undefined>(
        (front, horse) =>
          !front || (positions[horse.id] ?? 0) > (positions[front.id] ?? 0) ? horse : front,
        undefined,
      )
    },
    completedRounds: (state): number => state.results.length,
    totalRounds: (): number => ROUND_DISTANCES.length,
  },

  actions: {
    generateProgram() {
      if (this.status === 'running' || this.status === 'paused') return
      this.schedule = createSchedule(this.horses)
      this.reset()
    },

    start() {
      if (this.status !== 'ready' || this.schedule.length !== ROUND_DISTANCES.length) return
      // Sampling once makes the race independent of frame rate and pause duration.
      this.racePlans = this.schedule.map((round) => createRacePlan(round, this.horses))
      this.status = 'running'
    },

    pause() {
      if (this.status === 'running') this.status = 'paused'
    },

    resume() {
      if (this.status === 'paused') this.status = 'running'
    },

    tick(deltaSeconds: number) {
      if (this.status !== 'running' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
      let remaining = deltaSeconds * SIMULATION_SPEED
      if (!Number.isFinite(remaining)) return

      while (remaining > 0 && this.status === 'running') {
        const plan = this.racePlans[this.currentRoundIndex]
        if (!plan) return
        const toFinish = Math.max(0, plan.duration - this.elapsedSeconds)

        if (remaining < toFinish) {
          this.elapsedSeconds += remaining
          return
        }

        remaining -= toFinish
        this.elapsedSeconds = plan.duration
        this.results.push(getRaceResult(plan))

        if (this.currentRoundIndex === this.schedule.length - 1) {
          this.status = 'finished'
          return
        }

        this.currentRoundIndex++
        this.elapsedSeconds = 0
      }
    },

    reset() {
      this.results = []
      this.racePlans = []
      this.currentRoundIndex = 0
      this.elapsedSeconds = 0
      this.status = this.schedule.length ? 'ready' : 'idle'
    },
  },
})
