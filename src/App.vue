<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRaceStore } from './stores/race'
import { useRaceClock } from './composables/useRaceClock'
import { useTheme } from './composables/useTheme'
import OpeningSequence from './components/OpeningSequence.vue'
import AppIcon from './components/AppIcon.vue'
import FieldExplorer from './components/FieldExplorer.vue'
import RaceExperience from './components/RaceExperience.vue'
import RaceProgram from './components/RaceProgram.vue'

const race = useRaceStore()
const { theme, toggleTheme } = useTheme()
const introActive = ref(true)
const pageRevealed = ref(false)
const homeLink = ref<HTMLAnchorElement>()
const selectedHorseId = ref<string | null>(null)
const experience = ref<InstanceType<typeof RaceExperience>>()
const helpDialog = ref<HTMLDialogElement>()
const resetDialog = ref<HTMLDialogElement>()
const controlsLocked = computed(() => race.status === 'running' || race.status === 'paused')
const actionLabel = computed(
  () =>
    ({
      idle: 'Start racing',
      ready: 'Start racing',
      running: 'Pause race',
      paused: 'Resume race',
      finished: 'Race again',
    })[race.status],
)
const announcement = computed(() =>
  race.status === 'finished'
    ? 'Race day complete. All six rounds are available in Results.'
    : `${race.status === 'running' ? 'Racing' : race.status}. ${race.completedRounds} of 6 rounds complete.`,
)
useRaceClock()

async function completeOpening(restoreFocus: boolean) {
  pageRevealed.value = true
  introActive.value = false
  await nextTick()
  if (restoreFocus) homeLink.value?.focus({ preventScroll: true })
}

async function selectHorse(id: string) {
  selectedHorseId.value = id
  await nextTick()
  experience.value?.followHorse()
}

async function followHorse(id: string) {
  await selectHorse(id)
  document.getElementById('race-day')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  })
}

function primaryAction() {
  if (race.status === 'running') race.pause()
  else if (race.status === 'paused') race.resume()
  else if (race.status === 'finished') {
    race.reset()
    race.start()
  } else race.start()
}
function confirmReset() {
  race.pause()
  resetDialog.value?.showModal()
}
function resetProgram() {
  race.reset()
  resetDialog.value?.close()
}
function showHelp() {
  if (race.status === 'running') race.pause()
  helpDialog.value?.showModal()
}
</script>

<template>
  <OpeningSequence v-if="introActive" @reveal="pageRevealed = true" @complete="completeOpening" />
  <div class="app-shell" :class="{ 'is-revealed': pageRevealed }" :inert="introActive">
    <a class="skip-link" href="#main">Skip to race day</a>
    <header class="club-header">
      <a ref="homeLink" class="club-brand" href="./" aria-label="Paddock home"
        ><span class="club-monogram">p.</span
        ><span>paddock<small>THE VIRTUAL RACING CLUB</small></span></a
      >
      <nav class="club-nav" aria-label="Main navigation">
        <a href="#race-day">The race</a><a href="#contenders">The contenders</a>
      </nav>
      <div class="club-utilities">
        <button
          class="theme-toggle"
          :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`"
          @click="toggleTheme"
        >
          <span class="theme-toggle-icon"
            ><AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="16"
          /></span>
          <span>{{ theme === 'dark' ? 'Day mode' : 'Night mode' }}</span>
        </button>
        <button class="text-button club-help" @click="showHelp">
          <AppIcon name="info" :size="15" />How it works
        </button>
      </div>
    </header>
    <main id="main" class="club-main">
      <section class="club-intro" aria-labelledby="hero-title">
        <div>
          <span class="club-kicker"><i></i>THE PADDOCK CLASSIC — VOLUME 01</span>
          <h1 id="hero-title">
            <span class="headline-line"><span>A little chance.</span></span
            ><span class="headline-line"><em>A beautiful race.</em></span>
          </h1>
        </div>
        <div class="club-intro-note">
          <span class="intro-rule"></span>
          <p>
            Twenty contenders. Six chapters.<br />Take your seat for a race day<br />that never
            tells the same story twice.
          </p>
          <div>
            <span><b>20</b> CONTENDERS</span><span><b>06</b> ROUNDS</span
            ><span><b>01</b> RACE DAY</span>
          </div>
        </div>
      </section>
      <section id="race-day" class="race-day-section" aria-label="Race day">
        <div class="race-day-toolbar">
          <div class="meet-title">
            <span class="meet-dot"></span>
            <div>
              <strong>Your race day</strong
              ><span>{{
                race.status === 'idle'
                  ? 'Draw your line-up. Let the story begin.'
                  : race.status === 'finished'
                    ? 'Six rounds. A finish to remember.'
                    : `Round ${race.currentRound?.id ?? 1} of 6 · Ten contenders on the turf`
              }}</span>
            </div>
          </div>
          <div class="main-actions">
            <button
              v-if="race.status !== 'idle' && race.status !== 'ready'"
              class="text-button toolbar-reset"
              aria-label="Reset race day"
              @click="confirmReset"
            >
              <AppIcon name="refresh" :size="14" /><span>Reset race day</span>
            </button>
            <button
              class="button secondary"
              :disabled="controlsLocked"
              :title="controlsLocked ? 'Reset the race before generating a new program' : undefined"
              @click="race.generateProgram()"
            >
              <AppIcon name="shuffle" :size="16" />{{
                race.schedule.length ? 'New program' : 'Generate program'
              }}
            </button>
            <button
              class="button primary"
              :disabled="race.status === 'idle'"
              @click="primaryAction"
            >
              <AppIcon
                :name="
                  race.status === 'running'
                    ? 'pause'
                    : race.status === 'finished'
                      ? 'refresh'
                      : 'play'
                "
                :size="16"
              />{{ actionLabel }}<AppIcon v-if="race.status === 'ready'" name="arrow" :size="15" />
            </button>
          </div>
        </div>
        <div class="experience-layout">
          <RaceExperience
            ref="experience"
            :theme="theme"
            :selected-horse-id="selectedHorseId"
            @select="selectHorse"
          /><RaceProgram />
        </div>
      </section>
      <div class="club-interlude">
        <span>THE SPORT OF POSSIBILITY</span>
        <p>Pick a favourite. <em>Feel every finish.</em></p>
        <a href="#contenders">Meet your field <AppIcon name="arrow" :size="15" /></a>
      </div>
      <div id="contenders">
        <FieldExplorer
          :horses="race.horses"
          :active-ids="race.currentRound?.horseIds ?? []"
          :selected-id="selectedHorseId"
          @select="selectHorse"
          @follow="followHorse"
        />
      </div>
      <footer class="club-footer">
        <a href="#main" class="footer-wordmark">paddock.</a>
        <p>A little chance. A great race.</p>
        <span>A RACING SIMULATION · NO STAKES, JUST THE SPORT</span>
      </footer>
      <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
    </main>
    <dialog ref="helpDialog" class="modal" aria-labelledby="help-title">
      <button class="modal-close" aria-label="Close instructions" @click="helpDialog?.close()">
        <AppIcon name="close" /></button
      ><span class="eyebrow">WELCOME TO THE PADDOCK</span>
      <h2 id="help-title">Make a race day of it.</h2>
      <ol class="how-to">
        <li>
          <strong>Meet the field.</strong>
          <p>
            20 horses, each with a unique colour and a condition score from 1 to 100. A higher
            condition improves a horse’s chances, but every race has a little uncertainty.
          </p>
        </li>
        <li>
          <strong>Generate your program.</strong>
          <p>
            Six rounds from 1,200 to 2,200 metres. Each round draws 10 different horses from the
            paddock.
          </p>
        </li>
        <li>
          <strong>Watch it unfold.</strong>
          <p>
            Start once and all six rounds run in sequence. Pause whenever you like. Full results
            appear after each round.
          </p>
        </li>
      </ol>
      <div class="help-note">
        <AppIcon name="info" :size="18" />
        <p>
          Races run at 8× speed. Switching away from this tab pauses the race so you never miss a
          finish. Refreshing the page starts a new session.
        </p>
      </div>
      <button class="button primary" @click="helpDialog?.close()">
        Got it<AppIcon name="arrow" :size="16" />
      </button>
    </dialog>
    <dialog ref="resetDialog" class="modal reset-modal" aria-labelledby="reset-title">
      <span class="eyebrow">A FRESH START</span>
      <h2 id="reset-title">Reset this race day?</h2>
      <p>
        This clears all results and returns the current program to the starting line. Your horses
        and line-up stay the same.
      </p>
      <div class="modal-actions">
        <button class="button secondary" @click="resetDialog?.close()">Keep race day</button
        ><button class="button primary" @click="resetProgram">Reset race day</button>
      </div>
    </dialog>
  </div>
</template>
