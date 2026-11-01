<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type Component,
  type ShallowRef,
} from 'vue'
import { useRaceStore } from '../stores/race'
import { ROUND_DISTANCES } from '../domain/race'
import RaceTrack from './RaceTrack.vue'
import RacePodium from './RacePodium.vue'
import AppIcon from './AppIcon.vue'
import { loadWithTimeout } from '../scene/loadWithTimeout'

const RaceScene: ShallowRef<Component | null> = shallowRef(null)
const props = defineProps<{ selectedHorseId: string | null; theme: 'light' | 'dark' }>()
const emit = defineEmits<{ select: [id: string] }>()
const race = useRaceStore()
const view = ref<'scene' | 'classic'>('scene')
const camera = ref<'overview' | 'follow' | 'finish'>('overview')
const sceneReady = ref(false)
const sceneFailed = ref(false)
const sceneVersion = ref(0)
let sceneDownload: AbortController | undefined

async function loadScene() {
  if (RaceScene.value || sceneDownload) return
  const controller = new AbortController()
  sceneDownload = controller
  try {
    const module = await loadWithTimeout(() => import('./RaceScene.vue'), 15_000, controller.signal)
    if (!controller.signal.aborted) RaceScene.value = module.default
  } catch {
    if (!controller.signal.aborted) fallback()
  } finally {
    if (sceneDownload === controller) sceneDownload = undefined
  }
}

function cancelSceneDownload() {
  const download = sceneDownload
  sceneDownload = undefined
  download?.abort()
}

watch(
  view,
  (next) => {
    if (next === 'scene') void loadScene()
    else cancelSceneDownload()
  },
  { immediate: true },
)
onBeforeUnmount(cancelSceneDownload)
const cameraOptions = [
  { id: 'overview' as const, name: 'Grandstand', number: '01' },
  { id: 'follow' as const, name: 'Trackside', number: '02' },
  { id: 'finish' as const, name: 'Finish line', number: '03' },
]
const states = {
  idle: 'The gates are open',
  ready: 'Ready to race',
  running: 'Live race',
  paused: 'Race paused',
  finished: 'Race day complete',
}
const selectedHorse = computed(() =>
  race.horses.find((horse) => horse.id === props.selectedHorseId),
)
const selectedActive = computed(
  () =>
    !!props.selectedHorseId &&
    race.currentHorses.some((horse) => horse.id === props.selectedHorseId),
)
const standings = computed(() => {
  const plan = race.racePlans[race.currentRoundIndex]
  return [...race.currentHorses].sort((a, b) => {
    const pa = race.positions[a.id] ?? 0
    const pb = race.positions[b.id] ?? 0
    if (pa >= 100 && pb >= 100)
      return (
        (plan?.runners.find((r) => r.horseId === a.id)?.finishTime ?? 0) -
        (plan?.runners.find((r) => r.horseId === b.id)?.finishTime ?? 0)
      )
    return pb - pa
  })
})
const finalResult = computed(() => (race.status === 'finished' ? race.results.at(-1) : undefined))
const clock = computed(() => {
  const tenths = Math.round(race.elapsedSeconds * 10)
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`
})
const raceProgress = computed(() => Math.max(0, ...Object.values(race.positions)))
function selectHorse(id: string) {
  emit('select', id)
  camera.value = 'follow'
}
function followHorse() {
  if (selectedActive.value) {
    switchView('scene')
    camera.value = 'follow'
  }
}
function fallback() {
  sceneFailed.value = true
  view.value = 'classic'
}
function switchView(next: 'scene' | 'classic') {
  if (next === view.value) return
  view.value = next
  if (next === 'scene') {
    sceneReady.value = false
    sceneFailed.value = false
    sceneVersion.value++
  }
}
defineExpose({ followHorse })
</script>

<template>
  <section class="race-experience" aria-labelledby="experience-title">
    <header class="experience-head">
      <div>
        <span class="eyebrow">THE MAIN EVENT</span>
        <h2 id="experience-title">The home straight<span>.</span></h2>
      </div>
      <div class="view-switch" aria-label="Race presentation">
        <button :aria-pressed="view === 'scene'" @click="switchView('scene')">3D experience</button>
        <button :aria-pressed="view === 'classic'" @click="switchView('classic')">
          Classic view
        </button>
      </div>
    </header>

    <template v-if="view === 'scene'">
      <div class="experience-rounds" aria-label="Six-round race day progress">
        <div
          v-for="(distance, index) in ROUND_DISTANCES"
          :key="distance"
          :class="{
            active: race.currentRound?.id === index + 1,
            complete: race.completedRounds > index,
          }"
          :aria-current="race.currentRound?.id === index + 1 ? 'step' : undefined"
        >
          <span class="round-no"
            ><AppIcon v-if="race.completedRounds > index" name="check" :size="12" /><template
              v-else
              >{{ String(index + 1).padStart(2, '0') }}</template
            ></span
          >
          <span>{{ distance.toLocaleString('en-GB') }}<small>m</small></span>
        </div>
      </div>
      <div class="scene-stage" :class="{ 'is-loading': !sceneReady }">
        <component
          :is="RaceScene"
          v-if="RaceScene"
          :theme="theme"
          :key="sceneVersion"
          :selected-horse-id="selectedActive ? selectedHorseId : null"
          :camera-mode="camera"
          @select="selectHorse"
          @ready="sceneReady = true"
          @fallback="fallback"
        />
        <div v-if="!sceneReady" class="scene-loading">
          <span></span>
          <p>Preparing your front-row seat.</p>
          <small>THE PADDOCK CLASSIC</small>
        </div>
        <div class="scene-topline">
          <span class="scene-state" :class="race.status"><i></i>{{ states[race.status] }}</span>
          <span class="scene-edition">THE CLASSIC <b>06</b></span>
        </div>
        <div class="scene-caption">
          <span>{{
            camera === 'overview'
              ? 'A view of possibility.'
              : camera === 'follow'
                ? 'Every stride, up close.'
                : 'Where it all comes together.'
          }}</span
          ><small>{{
            camera === 'follow'
              ? `FOLLOWING ${selectedActive ? selectedHorse?.name : (race.leader?.name ?? 'THE FIELD')}`
              : camera === 'finish'
                ? 'THE FINISH LINE'
                : 'YOUR PRIVATE GRANDSTAND'
          }}</small>
        </div>
        <div class="scene-camera" aria-label="Camera angle">
          <button
            v-for="angle in cameraOptions"
            :key="angle.id"
            :aria-pressed="camera === angle.id"
            @click="camera = angle.id"
          >
            <small>{{ angle.number }}</small
            >{{ angle.name }}
          </button>
        </div>
        <span class="scene-hint"
          >Click a horse to follow its race <AppIcon name="arrow" :size="13"
        /></span>
      </div>
      <div class="experience-telemetry">
        <div class="track-meta">
          <span class="eyebrow">ON THE CARD</span
          ><strong>Round {{ race.currentRound?.id ?? '—' }} <span>/ 6</span></strong>
        </div>
        <div>
          <span class="eyebrow">DISTANCE</span
          ><strong
            >{{ (race.currentRound?.distance ?? 1200).toLocaleString('en-GB') }}
            <span>metres</span></strong
          >
        </div>
        <div class="race-clock">
          <span class="eyebrow">RACE TIME · 8×</span><strong>{{ clock }}</strong>
        </div>
        <div class="telemetry-progress">
          <span class="eyebrow">TO THE FINISH</span>
          <div><span :style="{ width: `${raceProgress}%` }"></span></div>
        </div>
      </div>
      <div class="field-order">
        <span class="eyebrow">{{
          race.elapsedSeconds > 0 ? 'LEADING THE FIELD' : 'THE STARTING LINE'
        }}</span>
        <div v-if="standings.length" class="order-chips">
          <button
            v-for="(horse, index) in standings.slice(0, 3)"
            :key="horse.id"
            :aria-pressed="selectedHorseId === horse.id"
            @click="selectHorse(horse.id)"
          >
            <span class="order-position">{{ String(index + 1).padStart(2, '0') }}</span
            ><i :style="{ background: horse.color }"></i>{{ horse.name
            }}<AppIcon name="arrow" :size="12" />
          </button>
        </div>
        <p v-else>Twenty contenders. Your race day starts with a fresh draw.</p>
      </div>
      <RacePodium v-if="finalResult" :result="finalResult" :horses="race.horses" />
    </template>
    <template v-else>
      <p v-if="sceneFailed" class="scene-fallback">
        The 3D view is unavailable on this device. Your complete race day is ready in Classic view.
      </p>
      <RaceTrack embedded />
    </template>
  </section>
</template>

<style scoped>
.race-experience {
  min-width: 0;
  background: #fefdf9;
  border: 1px solid #dedfd5;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 45px #1c302008;
}
.experience-head {
  padding: 24px 26px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.experience-head .eyebrow {
  font-size: 9px;
  letter-spacing: 2px;
  color: #859080;
}
.experience-head h2 {
  font:
    500 30px/1.2 'Playfair Display',
    serif;
  letter-spacing: -1px;
  margin-top: 7px;
}
.experience-head h2 > span {
  color: #b68b58;
}
.view-switch {
  display: flex;
  padding: 3px;
  background: #f0f1e9;
  border-radius: 7px;
  gap: 2px;
}
.view-switch button {
  font-size: 10px;
  padding: 8px 11px;
  border-radius: 5px;
  color: #7b8576;
  background: transparent;
  white-space: nowrap;
}
.view-switch button[aria-pressed='true'] {
  background: #fffef9;
  color: #263b2e;
  box-shadow: 0 1px 4px #1c302010;
}
.experience-rounds {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  padding: 0 26px 18px;
  gap: 6px;
}
.experience-rounds > div {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 39px;
  color: #929b89;
  font-size: 11px;
  border: 1px solid #e9ebe1;
  border-radius: 5px;
  background: #fafaf5;
}
.experience-rounds > div.active {
  border-color: #527456;
  background: #edf1e6;
  color: #25442e;
}
.experience-rounds > div.complete {
  color: #416846;
  background: #f0f3e9;
}
.experience-rounds small {
  font-size: 8px;
  margin-left: 3px;
}
.round-no {
  font:
    500 10px/1 'DM Sans',
    sans-serif;
  opacity: 0.65;
}
.scene-stage {
  height: 520px;
  background: #e9e8df;
  position: relative;
  isolation: isolate;
  overflow: hidden;
}
.scene-stage::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, #e9e8df38, transparent 22%, transparent 75%, #e9e8df70);
  z-index: 1;
}
.scene-stage :deep(.race-scene) {
  position: absolute;
  inset: 0;
}
.scene-topline {
  position: absolute;
  top: 22px;
  left: 26px;
  right: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 3;
}
.scene-state {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  background: #fffef9bb;
  backdrop-filter: blur(8px);
  padding: 9px 12px;
  border: 1px solid #fff9;
  border-radius: 40px;
  color: #486144;
}
.scene-state i {
  width: 5px;
  height: 5px;
  background: #73935d;
  border-radius: 50%;
}
.scene-state.running i {
  background: #5c934c;
  box-shadow: 0 0 0 4px #72945818;
}
.scene-state.paused i {
  background: #b99551;
}
.scene-edition {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 8px;
  letter-spacing: 2px;
  color: #7c8674;
}
.scene-edition b {
  font:
    italic 500 27px/1 'Playfair Display',
    serif;
  letter-spacing: -1px;
}
.scene-caption {
  position: absolute;
  left: 26px;
  top: 85px;
  pointer-events: none;
  z-index: 3;
  max-width: 45%;
}
.scene-caption > span {
  font:
    italic 500 25px/1.2 'Playfair Display',
    serif;
  letter-spacing: -0.6px;
  color: #4b6048;
}
.scene-caption small {
  display: block;
  margin-top: 9px;
  font-size: 7px;
  letter-spacing: 1.8px;
  color: #8c9582;
}
.scene-camera {
  position: absolute;
  bottom: 24px;
  left: 26px;
  z-index: 4;
  display: flex;
  gap: 3px;
  background: #fafaf0d9;
  padding: 4px;
  border: 1px solid #fff9;
  border-radius: 8px;
  backdrop-filter: blur(14px);
  box-shadow: 0 5px 25px #2834210c;
}
.scene-camera button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  font-size: 10px;
  background: transparent;
  border-radius: 5px;
  color: #6c7764;
  transition:
    background 0.2s,
    color 0.2s;
}
.scene-camera button small {
  font-size: 8px;
  opacity: 0.5;
}
.scene-camera button[aria-pressed='true'] {
  background: #2c4632;
  color: #f5f2e3;
}
.scene-hint {
  position: absolute;
  right: 26px;
  bottom: 41px;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 9px;
  color: #78836e;
  z-index: 3;
  pointer-events: none;
}
.scene-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #e9e8df;
  z-index: 5;
  color: #54654c;
  gap: 14px;
}
.scene-loading > span {
  width: 28px;
  height: 28px;
  border: 1px solid #6f855340;
  border-top-color: #57724c;
  border-radius: 50%;
  animation: seat-loading 1s linear infinite;
}
.scene-loading p {
  font:
    italic 24px 'Playfair Display',
    serif;
}
.scene-loading small {
  font-size: 8px;
  letter-spacing: 2px;
}
.experience-telemetry {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1.2fr;
  gap: 20px;
  padding: 20px 26px;
  border-bottom: 1px solid #e8e9df;
}
.experience-telemetry > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.experience-telemetry .track-meta {
  margin: 0;
  padding: 0;
  border: 0;
  min-height: 0;
  align-items: flex-start;
}
.experience-telemetry .eyebrow {
  font-size: 8px;
  letter-spacing: 1.5px;
  color: #939c88;
}
.experience-telemetry strong {
  font:
    500 19px/1.2 'DM Sans',
    sans-serif;
  letter-spacing: -0.6px;
  color: #2f4934;
}
.experience-telemetry strong > span {
  font-size: 10px;
  color: #9aa18f;
  letter-spacing: 0;
}
.experience-telemetry .race-clock {
  text-align: left;
  align-items: flex-start;
}
.telemetry-progress > div {
  height: 3px;
  border-radius: 3px;
  background: #e8ebdd;
  margin-top: 10px;
  overflow: hidden;
}
.telemetry-progress > div > span {
  height: 100%;
  display: block;
  background: #70885b;
}
.field-order {
  padding: 18px 26px;
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 71px;
}
.field-order > .eyebrow {
  font-size: 8px;
  letter-spacing: 1.3px;
  white-space: nowrap;
  color: #8c9780;
}
.field-order > p {
  font-size: 11px;
  color: #869079;
}
.order-chips {
  display: flex;
  gap: 7px;
  min-width: 0;
  flex: 1;
}
.order-chips button {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #e7e9df;
  border-radius: 5px;
  padding: 9px 10px;
  font-size: 10px;
  background: #fafaf5;
  min-width: 0;
  white-space: nowrap;
  flex: 1;
}
.order-chips button[aria-pressed='true'] {
  border-color: #718661;
  background: #eef2e5;
}
.order-position {
  color: #99a28d;
  font-size: 9px;
}
.order-chips i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.order-chips svg {
  margin-left: auto;
  color: #a3ac96;
}
.scene-fallback {
  font-size: 12px;
  padding: 8px 26px 20px;
  color: #7d856f;
}
.race-experience > :deep(.race-podium) {
  margin: 0 26px 20px;
  color: #304832;
}
.race-experience > :deep(.track-panel) {
  border-radius: 0;
  box-shadow: none;
}
@keyframes seat-loading {
  to {
    transform: rotate(360deg);
  }
}
@media (min-width: 1600px) {
  .scene-stage {
    height: 590px;
  }
}
@media (max-width: 1150px) {
  .scene-caption > span {
    font-size: 21px;
  }
  .scene-hint {
    display: none;
  }
  .field-order {
    display: block;
  }
  .order-chips {
    margin-top: 10px;
  }
  .scene-stage {
    height: 500px;
  }
}
@media (max-width: 760px) {
  .experience-head {
    padding: 20px 18px 16px;
    align-items: flex-start;
  }
  .experience-head h2 {
    font-size: 25px;
  }
  .experience-head .eyebrow {
    font-size: 7px;
  }
  .view-switch {
    margin-top: 7px;
  }
  .view-switch button {
    padding: 6px 7px;
    font-size: 8px;
  }
  .experience-rounds {
    padding: 0 16px 15px;
    gap: 4px;
  }
  .experience-rounds > div {
    flex-direction: column;
    gap: 6px;
    padding: 7px 0;
    font-size: 9px;
  }
  .round-no {
    font-size: 8px;
  }
  .scene-stage {
    height: 430px;
  }
  .scene-topline {
    left: 18px;
    right: 18px;
    top: 18px;
  }
  .scene-caption {
    display: none;
  }
  .scene-caption > span {
    font-size: 21px;
  }
  .scene-camera {
    left: 16px;
    right: 16px;
    bottom: 18px;
    justify-content: center;
  }
  .scene-camera button {
    flex: 1;
    justify-content: center;
    gap: 6px;
    font-size: 9px;
    padding: 10px 6px;
  }
  .experience-telemetry {
    padding: 19px 18px;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }
  .experience-telemetry strong {
    font-size: 17px;
  }
  .experience-telemetry .eyebrow {
    font-size: 6.5px;
  }
  .experience-telemetry .telemetry-progress {
    display: none;
  }
  .field-order {
    padding: 16px 18px;
  }
  .order-chips {
    display: grid;
    grid-template-columns: 1fr;
  }
  .order-chips button {
    padding: 9px 11px;
    font-size: 11px;
  }
  .scene-loading p {
    font-size: 21px;
  }
  .scene-edition {
    font-size: 6px;
    letter-spacing: 1px;
  }
  .race-experience > :deep(.race-podium) {
    margin: 0 18px 18px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scene-loading > span {
    animation: none;
  }
  .scene-camera button {
    transition: none;
  }
}
</style>
