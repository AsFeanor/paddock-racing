<script setup lang="ts">
import { computed } from 'vue'
import { useRaceStore } from '../stores/race'
import { ROUND_DISTANCES } from '../domain/race'
import HorseSprite from './HorseSprite.vue'
import RacePodium from './RacePodium.vue'
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
const race = useRaceStore()
const displayHorses = computed(() =>
  race.currentHorses.length ? race.currentHorses : race.horses.slice(0, 10),
)
const finalResult = computed(() => (race.status === 'finished' ? race.results.at(-1) : undefined))
const labels = {
  idle: 'Awaiting program',
  ready: 'At the starting gate',
  running: 'Live race',
  paused: 'Paused',
  finished: 'Race day complete',
}
const formatTime = (time: number) => {
  const tenths = Math.round(time * 10)
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`
}
</script>

<template>
  <section
    class="panel track-panel"
    :aria-labelledby="embedded ? undefined : 'track-title'"
    :aria-label="embedded ? 'Classic racecourse' : undefined"
    :class="`track-is-${race.status}`"
  >
    <div v-if="!embedded" class="panel-heading track-heading">
      <div>
        <span class="eyebrow">THE MAIN EVENT</span>
        <h2 id="track-title">
          {{ race.status === 'finished' ? 'A finish to remember.' : 'The home straight.' }}
        </h2>
      </div>
      <span class="status-badge" :class="race.status"><span></span>{{ labels[race.status] }}</span>
    </div>
    <div class="round-progress" aria-label="Six-round race day progress">
      <span
        v-for="(distance, index) in ROUND_DISTANCES"
        :key="distance"
        :class="{
          active: race.currentRound?.id === index + 1,
          complete: race.completedRounds > index,
        }"
        :aria-current="race.currentRound?.id === index + 1 ? 'step' : undefined"
      >
        <span class="round-progress-index"
          ><AppIcon v-if="race.completedRounds > index" name="check" :size="12" /><template
            v-else
            >{{ String(index + 1).padStart(2, '0') }}</template
          ></span
        ><span>{{ distance.toLocaleString('en-GB') }}<small>m</small></span>
      </span>
    </div>
    <div class="track-meta">
      <span
        ><strong>Round {{ race.currentRound?.id ?? '—' }}</strong
        ><span class="meta-divider">/</span>6</span
      ><span class="track-surface-caption"
        >TURF <span>·</span> {{ race.currentHorses.length || 10 }} RUNNERS</span
      ><span class="distance-label"
        ><AppIcon name="flag" :size="14" />{{
          race.currentRound
            ? `${race.currentRound.distance.toLocaleString('en-GB')} m`
            : 'Ready when you are'
        }}</span
      >
    </div>
    <div
      class="racecourse"
      :class="{ unstarted: race.status === 'idle' }"
      role="group"
      :aria-label="
        race.status === 'idle'
          ? 'Empty racecourse with ten lanes'
          : `Round ${race.currentRound?.id}, ${labels[race.status]}. See the results panel for finishing positions.`
      "
    >
      <div class="track-markers">
        <span>STARTING GATE</span><span>THE HOME STRAIGHT</span><span>FINISH</span>
      </div>
      <div class="lanes" aria-hidden="true">
        <div
          v-for="(horse, index) in displayHorses"
          :key="`${race.currentRound?.id}-${horse.id}`"
          class="lane"
          :class="{
            'is-leading': race.leader?.id === horse.id,
            'has-finished': (race.positions[horse.id] ?? 0) >= 100,
          }"
          :style="{ '--horse-color': horse.color }"
        >
          <span class="lane-identity"
            ><span class="lane-number">{{ String(index + 1).padStart(2, '0') }}</span
            ><span class="lane-name">{{ horse.name }}</span></span
          >
          <div class="running-space">
            <span class="lane-trail" :style="{ width: `${race.positions[horse.id] ?? 0}%` }"></span>
            <div class="runner" :style="{ left: `${race.positions[horse.id] ?? 0}%` }">
              <HorseSprite
                :color="horse.color"
                :label="index + 1"
                :variant="index"
                :moving="race.status === 'running' && (race.positions[horse.id] ?? 0) < 100"
              /><span
                v-if="race.leader?.id === horse.id && race.elapsedSeconds > 0"
                class="race-position-badge"
                >1st</span
              >
            </div>
          </div>
        </div>
        <div class="finish-line"></div>
      </div>
      <div class="track-markers bottom">
        <span>0 m</span
        ><span>{{ race.currentRound ? `${race.currentRound.distance / 2} m` : '—' }}</span
        ><span>{{ race.currentRound ? `${race.currentRound.distance} m` : '—' }}</span>
      </div>
      <div v-if="race.status === 'idle'" class="track-empty">
        <div class="empty-symbol"><AppIcon name="flag" :size="26" /></div>
        <span class="eyebrow">SIX ROUNDS. ENDLESS POSSIBILITIES.</span>
        <h3>The field is yours.</h3>
        <p>Twenty thoroughbreds. A fresh line-up.<br />One unforgettable race day.</p>
        <button class="button primary" @click="race.generateProgram()">
          Generate program<AppIcon name="arrow" :size="16" />
        </button>
      </div>
      <div v-if="race.status === 'paused'" class="pause-overlay">
        <span><AppIcon name="pause" :size="15" /> Race paused</span>
      </div>
    </div>
    <RacePodium v-if="finalResult" :result="finalResult" :horses="race.horses" />
    <div class="track-footer">
      <div>
        <span class="eyebrow">{{
          race.status === 'finished' ? 'FINAL ROUND WINNER' : 'LEADING THE FIELD'
        }}</span
        ><strong v-if="race.leader"
          ><span class="color-dot" :style="{ background: race.leader.color }"></span
          >{{ race.leader.name }}</strong
        ><strong v-else class="muted">The field is open</strong>
      </div>
      <div class="race-clock">
        <span class="eyebrow">RACE TIME · 8× SPEED</span
        ><strong><AppIcon name="clock" :size="17" />{{ formatTime(race.elapsedSeconds) }}</strong>
      </div>
    </div>
  </section>
</template>
