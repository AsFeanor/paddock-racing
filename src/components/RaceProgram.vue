<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRaceStore } from '../stores/race'
import AppIcon from './AppIcon.vue'

const race = useRaceStore()
const tab = ref<'program' | 'results'>('program')
const expanded = ref(1)
const horseById = computed(() => Object.fromEntries(race.horses.map((horse) => [horse.id, horse])))
const completedRoundIds = computed(() => new Set(race.results.map((result) => result.roundId)))

function roundState(roundId: number) {
  if (completedRoundIds.value.has(roundId)) return 'Complete'
  if (race.currentRound?.id === roundId) {
    if (race.status === 'running') return 'Live'
    if (race.status === 'paused') return 'Paused'
    return 'Ready'
  }
  return 'Upcoming'
}
watch(
  () => race.currentRoundIndex,
  (index) => {
    if (tab.value === 'program') expanded.value = index + 1
  },
)
watch(
  () => race.status,
  (status) => {
    if (status === 'finished') {
      tab.value = 'results'
      expanded.value = 6
    }
  },
)
watch(
  // A reset replaces the result array; finishing a round only appends to it.
  // This also catches reset + start performed together by “Race again”.
  () => race.results,
  () => {
    tab.value = 'program'
    expanded.value = 1
  },
)
function selectTab(value: 'program' | 'results') {
  tab.value = value
  expanded.value =
    value === 'results' ? (race.results.at(-1)?.roundId ?? 1) : (race.currentRound?.id ?? 1)
}
function moveTab(value: 'program' | 'results') {
  selectTab(value)
  document.getElementById(`${value}-tab`)?.focus()
}
</script>

<template>
  <section class="panel program-panel" aria-labelledby="program-title">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">THE DAY'S RUNNING ORDER</span>
        <h2 id="program-title">The race card</h2>
      </div>
      <span class="program-panel-mark"><AppIcon name="flag" :size="20" /></span>
    </div>
    <div class="tabs" role="tablist" aria-label="Race day information">
      <button
        id="program-tab"
        role="tab"
        :aria-selected="tab === 'program'"
        aria-controls="race-day-content"
        :tabindex="tab === 'program' ? 0 : -1"
        :class="{ active: tab === 'program' }"
        @click="selectTab('program')"
        @keydown.right.prevent="moveTab('results')"
        @keydown.left.prevent="moveTab('results')"
        @keydown.end.prevent="moveTab('results')"
      >
        Program <span>6</span></button
      ><button
        id="results-tab"
        role="tab"
        :aria-selected="tab === 'results'"
        aria-controls="race-day-content"
        :tabindex="tab === 'results' ? 0 : -1"
        :class="{ active: tab === 'results' }"
        @click="selectTab('results')"
        @keydown.left.prevent="moveTab('program')"
        @keydown.right.prevent="moveTab('program')"
        @keydown.home.prevent="moveTab('program')"
      >
        Results <span>{{ race.results.length }}</span>
      </button>
    </div>
    <div
      id="race-day-content"
      class="program-content"
      role="tabpanel"
      :aria-labelledby="`${tab}-tab`"
      tabindex="0"
    >
      <template v-if="tab === 'program'">
        <div v-if="!race.schedule.length" class="side-empty">
          <span class="program-empty-art"><AppIcon name="shuffle" :size="28" /></span>
          <h3>A fresh line-up awaits.</h3>
          <p>Six distances. Ten contenders.<br />One beautifully unpredictable day.</p>
          <div class="empty-rounds">
            <span v-for="distance in [1200, 1400, 1600, 1800, 2000, 2200]" :key="distance"
              >{{ distance }} m</span
            >
          </div>
        </div>
        <div
          v-for="round in race.schedule"
          :key="round.id"
          class="round-card"
          :class="{
            expanded: expanded === round.id,
            current: race.currentRound?.id === round.id,
            completed: completedRoundIds.has(round.id),
          }"
        >
          <button
            class="round-heading"
            :aria-expanded="expanded === round.id"
            :aria-controls="`round-${round.id}`"
            @click="expanded = expanded === round.id ? 0 : round.id"
          >
            <span
              class="round-number"
              :class="{
                done: completedRoundIds.has(round.id),
              }"
              ><AppIcon v-if="completedRoundIds.has(round.id)" name="check" :size="15" /><template
                v-else
                >{{ String(round.id).padStart(2, '0') }}</template
              ></span
            ><span
              ><strong>Round {{ round.id }}</strong
              ><small>{{ round.distance.toLocaleString('en-GB') }} metres</small></span
            ><span
              class="round-state"
              :class="{
                live: roundState(round.id) === 'Live',
                complete: completedRoundIds.has(round.id),
                next: race.currentRound?.id === round.id,
              }"
              >{{ roundState(round.id) }}</span
            ><AppIcon name="chevron" :size="16" />
          </button>
          <div v-if="expanded === round.id" class="lineup-labels" aria-hidden="true">
            <span>STARTING GATE</span><span>CONDITION</span>
          </div>
          <ol
            v-if="expanded === round.id"
            :id="`round-${round.id}`"
            class="round-horses"
            role="list"
          >
            <li v-for="(id, index) in round.horseIds" :key="id">
              <span class="entry-number">{{ index + 1 }}</span
              ><span class="color-dot" :style="{ background: horseById[id]?.color }"></span
              ><span>{{ horseById[id]?.name }}</span
              ><span class="entry-condition">{{ horseById[id]?.condition }}</span>
            </li>
          </ol>
        </div>
      </template>
      <template v-else>
        <div v-if="!race.results.length" class="side-empty">
          <span class="program-empty-art"><AppIcon name="trophy" :size="28" /></span>
          <h3>The podium is waiting.</h3>
          <p>Each round’s full results will<br />appear here at the finish.</p>
        </div>
        <TransitionGroup name="result-arrival" tag="div" class="result-arrivals">
          <div
            v-for="result in race.results"
            :key="result.roundId"
            class="round-card"
            :class="{ expanded: expanded === result.roundId }"
          >
            <button
              class="round-heading"
              :aria-expanded="expanded === result.roundId"
              :aria-controls="`result-${result.roundId}`"
              @click="expanded = expanded === result.roundId ? 0 : result.roundId"
            >
              <span class="round-number done"><AppIcon name="trophy" :size="16" /></span
              ><span
                ><strong>Round {{ result.roundId }}</strong
                ><small>{{ result.distance.toLocaleString('en-GB') }} metres · Final</small></span
              ><span class="round-state complete">Official</span
              ><AppIcon name="chevron" :size="16" />
            </button>
            <div v-if="expanded === result.roundId" class="lineup-labels" aria-hidden="true">
              <span>FINISHING ORDER</span><span>TIME</span>
            </div>
            <ol
              v-if="expanded === result.roundId"
              :id="`result-${result.roundId}`"
              class="round-horses results-list"
              role="list"
            >
              <li
                v-for="entry in result.entries"
                :key="entry.horseId"
                :class="{ winner: entry.position === 1 }"
              >
                <span class="entry-number" :class="{ 'podium-position': entry.position <= 3 }">{{
                  entry.position
                }}</span
                ><span
                  class="color-dot"
                  :style="{ background: horseById[entry.horseId]?.color }"
                ></span
                ><span>{{ horseById[entry.horseId]?.name }}</span
                ><span class="entry-condition">{{ entry.time.toFixed(2) }}s</span>
              </li>
            </ol>
            <p v-else class="winner-summary">
              <span
                class="color-dot"
                :style="{
                  background: horseById[result.entries[0].horseId]?.color,
                }"
              ></span
              >{{ horseById[result.entries[0].horseId]?.name }}<span>1st</span>
            </p>
          </div>
        </TransitionGroup>
      </template>
    </div>
    <div class="program-footer">
      <span>{{ race.completedRounds }} of 6 rounds complete</span>
      <div
        class="completion-steps"
        role="progressbar"
        aria-label="Race day progress"
        :aria-valuenow="race.completedRounds"
        :aria-valuemin="0"
        :aria-valuemax="6"
      >
        <span
          v-for="round in 6"
          :key="round"
          class="step"
          :class="{
            done: round <= race.completedRounds,
            current: race.currentRound?.id === round && race.status !== 'finished',
          }"
        ></span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.program-panel-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 37px;
  height: 37px;
  border: 1px solid #dce3d4;
  border-radius: 50%;
  color: #778868;
}
.program-empty-art {
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin: 0 auto 19px;
  background: #edf1e4;
  color: #6c825a;
  box-shadow: 0 0 0 9px #f7f8f0;
}
.round-state {
  color: #829075;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.55px;
}
.round-state.next {
  color: #547539;
}
.round-state.live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #41682d;
}
.round-state.live::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #73a442;
  box-shadow: 0 0 0 3px #73a44214;
}
.round-state.complete {
  color: #6e845e;
}
.lineup-labels {
  display: flex;
  justify-content: space-between;
  padding: 12px 12px 5px;
  color: #8b9581;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 1px;
}
.lineup-labels + .round-horses {
  border-top: 0;
}
.podium-position {
  color: #668247;
  font-weight: 700;
}
.completion-steps {
  display: flex;
  gap: 5px;
  margin-top: 11px;
}
.completion-steps .step {
  flex: 1;
  height: 4px;
  border-radius: 3px;
  background: #e7ebdf;
  transition: background 0.3s;
}
.completion-steps .step.done {
  background: #6d8c4e;
}
.completion-steps .step.current {
  background: #c2d3a7;
}
.result-arrival-enter-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.result-arrival-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.result-arrival-leave-active {
  transition: opacity 0.15s ease;
}
.result-arrival-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .result-arrival-enter-active,
  .result-arrival-leave-active,
  .completion-steps .step {
    transition: none;
  }
}
</style>
