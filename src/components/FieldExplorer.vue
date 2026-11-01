<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Horse } from '../domain/race'
import HorseSprite from './HorseSprite.vue'

const props = defineProps<{
  horses: Horse[]
  activeIds: string[]
  selectedId: string | null
}>()
const emit = defineEmits<{ select: [id: string]; follow: [id: string] }>()
const filter = ref<'all' | 'race'>('all')
const sort = ref<'number' | 'condition' | 'name'>('number')
const activeSet = computed(() => new Set(props.activeIds))
const numbers = computed(() => new Map(props.horses.map((horse, index) => [horse.id, index + 1])))
const activeCount = computed(
  () => props.horses.filter((horse) => activeSet.value.has(horse.id)).length,
)
const focusedHorse = computed(
  () =>
    props.horses.find((horse) => horse.id === props.selectedId) ??
    props.horses.find((horse) => activeSet.value.has(horse.id)) ??
    props.horses[0],
)
const visibleHorses = computed(() => {
  const horses = props.horses.filter(
    (horse) => filter.value === 'all' || activeSet.value.has(horse.id),
  )
  if (sort.value === 'condition') return horses.sort((a, b) => b.condition - a.condition)
  if (sort.value === 'name') return horses.sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return horses
})
watch(activeCount, (count) => {
  if (!count) filter.value = 'all'
})
const numberOf = (id: string) => String(numbers.value.get(id) ?? 0).padStart(2, '0')
</script>

<template>
  <section class="field-explorer" aria-labelledby="field-title">
    <div class="field-heading">
      <div>
        <p class="field-eyebrow">THE PADDOCK <span>/</span> {{ horses.length }} THOROUGHBREDS</p>
        <h2 id="field-title">Meet the contenders<span>.</span></h2>
      </div>
      <p class="field-introduction">Every horse has a colour. Every race, a new possibility.</p>
    </div>

    <div
      v-if="focusedHorse"
      class="field-profile"
      :style="{ '--runner-color': focusedHorse.color }"
    >
      <div class="profile-art" aria-hidden="true">
        <span class="profile-orbit"></span>
        <span class="profile-number">{{ numberOf(focusedHorse.id) }}</span>
        <div class="profile-horse">
          <HorseSprite :color="focusedHorse.color" :label="numbers.get(focusedHorse.id)" />
        </div>
      </div>
      <div class="profile-identity">
        <span class="profile-kicker">{{
          selectedId ? 'YOUR SELECTED CONTENDER' : 'A CLOSER LOOK'
        }}</span>
        <h3>{{ focusedHorse.name }}</h3>
        <span class="profile-status">
          <span :class="{ 'is-active': activeSet.has(focusedHorse.id) }"></span>
          {{ activeSet.has(focusedHorse.id) ? 'In the current line-up' : 'In the paddock' }}
        </span>
      </div>
      <div class="profile-condition" :aria-label="`Condition ${focusedHorse.condition} out of 100`">
        <span class="profile-kicker">CONDITION</span>
        <div>
          <strong>{{ focusedHorse.condition }}</strong
          ><span>/ 100</span>
        </div>
        <span class="profile-meter" aria-hidden="true"
          ><span :style="{ width: `${focusedHorse.condition}%` }"></span
        ></span>
      </div>
      <button
        v-if="activeSet.has(focusedHorse.id)"
        class="profile-follow"
        @click="emit('follow', focusedHorse.id)"
      >
        Follow on track
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span v-else class="profile-resting">A new program brings<br />a new chance to run.</span>
    </div>

    <div class="field-toolbar">
      <div class="field-filters" role="group" aria-label="Filter contenders">
        <button :aria-pressed="filter === 'all'" @click="filter = 'all'">
          All contenders <span>{{ horses.length }}</span>
        </button>
        <button :aria-pressed="filter === 'race'" :disabled="!activeCount" @click="filter = 'race'">
          This race <span>{{ activeCount }}</span>
        </button>
      </div>
      <label class="field-sort">
        <span>Sort by</span>
        <select v-model="sort" aria-label="Sort contenders">
          <option value="number">Number</option>
          <option value="condition">Condition</option>
          <option value="name">Name</option>
        </select>
      </label>
    </div>

    <ol class="contender-grid" role="list">
      <li v-for="horse in visibleHorses" :key="horse.id">
        <button
          class="contender-card"
          :class="{ 'is-selected': selectedId === horse.id, 'is-in-race': activeSet.has(horse.id) }"
          :style="{ '--runner-color': horse.color }"
          :aria-pressed="selectedId === horse.id"
          :aria-label="`${horse.name}, condition ${horse.condition} out of 100${activeSet.has(horse.id) ? ', in the current race' : ', in the paddock'}. Select contender.`"
          @click="emit('select', horse.id)"
        >
          <span class="contender-topline">
            <span class="contender-number">{{ numberOf(horse.id) }}</span>
            <span class="contender-availability"
              ><span></span>{{ activeSet.has(horse.id) ? 'THIS RACE' : 'PADDOCK' }}</span
            >
            <svg
              class="contender-arrow"
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M7 17 17 7M7 7h10v10"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <strong class="contender-name">{{ horse.name }}</strong>
          <span class="contender-condition"
            ><span>Condition</span><strong>{{ horse.condition }}<small>/100</small></strong></span
          >
          <span class="contender-meter" aria-hidden="true"
            ><span :style="{ width: `${horse.condition}%` }"></span
          ></span>
        </button>
      </li>
    </ol>
    <p class="field-footnote">
      Condition influences performance. The finish is never a foregone conclusion.
    </p>
  </section>
</template>

<style scoped>
.field-explorer {
  --field-ink: #292d27;
  --field-muted: #626b5a;
  --field-line: #dedfd5;
  color: var(--field-ink);
  padding: 48px 0 0;
}
.field-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 30px;
  margin-bottom: 25px;
}
.field-eyebrow,
.profile-kicker {
  font-size: 9px;
  line-height: 1.5;
  letter-spacing: 1.8px;
  font-weight: 500;
  color: var(--field-muted);
}
.field-eyebrow span {
  padding: 0 9px;
  color: #aaa99b;
}
.field-heading h2 {
  margin-top: 9px;
  font:
    500 clamp(27px, 2.5vw, 38px)/1.2 'Playfair Display',
    Georgia,
    serif;
  letter-spacing: -1px;
}
.field-heading h2 > span {
  color: #8e9876;
}
.field-introduction {
  max-width: 260px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--field-muted);
  text-align: right;
}
.field-profile {
  min-height: 172px;
  display: grid;
  grid-template-columns: 198px minmax(0, 1fr) 140px 170px;
  align-items: center;
  gap: 26px;
  padding: 0 36px 0 16px;
  border: 1px solid var(--field-line);
  border-radius: 5px;
  background: linear-gradient(100deg, #eeeee5, #f8f7f1 48%, #f4f3eb);
  overflow: hidden;
}
.profile-art {
  align-self: stretch;
  position: relative;
  min-height: 170px;
}
.profile-orbit {
  position: absolute;
  width: 154px;
  height: 154px;
  left: 21px;
  top: 9px;
  border: 1px solid #d6d8ca;
  border-radius: 50%;
}
.profile-orbit::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px dashed #d6d8ca;
  border-radius: inherit;
}
.profile-number {
  position: absolute;
  top: 15px;
  left: 16px;
  color: color-mix(in srgb, var(--runner-color) 11%, transparent);
  font:
    500 118px/1 'Playfair Display',
    Georgia,
    serif;
  letter-spacing: -8px;
}
.profile-horse {
  width: 188px;
  height: 188px;
  position: absolute;
  left: 4px;
  top: -19px;
}
.profile-identity {
  min-width: 0;
}
.profile-identity h3 {
  margin: 7px 0 10px;
  font:
    500 clamp(24px, 2vw, 31px)/1.2 'Playfair Display',
    Georgia,
    serif;
  letter-spacing: -0.65px;
}
.profile-status {
  display: flex;
  gap: 7px;
  align-items: center;
  color: var(--field-muted);
  font-size: 11px;
}
.profile-status > span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #babcae;
}
.profile-status > .is-active {
  background: #6e8252;
  box-shadow: 0 0 0 3px #6e825210;
}
.profile-condition {
  width: 116px;
}
.profile-condition > div {
  margin: 6px 0 11px;
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.profile-condition strong {
  font:
    500 31px/1 'Playfair Display',
    Georgia,
    serif;
  font-variant-numeric: tabular-nums;
}
.profile-condition > div > span {
  font-size: 10px;
  color: var(--field-muted);
}
.profile-meter,
.contender-meter {
  height: 3px;
  display: block;
  background: #dedfd4;
  overflow: hidden;
}
.profile-meter > span,
.contender-meter > span {
  display: block;
  height: 100%;
  background: #8c9975;
  transition: width 0.35s ease;
}
.profile-follow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 19px;
  padding: 15px 19px;
  border: 1px solid #bcbfaf;
  background: transparent;
  border-radius: 3px;
  font-size: 11px;
  transition:
    color 0.2s,
    background 0.2s,
    border-color 0.2s;
}
.profile-follow:hover {
  background: #293f30;
  color: #f9f8ef;
  border-color: #293f30;
}
.profile-resting {
  color: var(--field-muted);
  font-size: 11px;
  line-height: 1.7;
  text-align: right;
}
.field-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 0 19px;
}
.field-filters {
  display: flex;
  gap: 22px;
}
.field-filters button {
  display: flex;
  gap: 7px;
  align-items: center;
  background: transparent;
  padding: 8px 0;
  border-bottom: 1px solid transparent;
  color: var(--field-muted);
  font-size: 11px;
}
.field-filters button[aria-pressed='true'] {
  color: var(--field-ink);
  border-bottom-color: #293f30;
}
.field-filters button > span {
  font-size: 9px;
  color: var(--field-muted);
  background: #e9eadf;
  padding: 2px 5px;
  border-radius: 2px;
}
.field-filters button:disabled {
  opacity: 0.45;
}
.field-sort {
  display: flex;
  gap: 9px;
  align-items: center;
  font-size: 10px;
  color: var(--field-muted);
}
.field-sort select {
  padding: 8px 21px 8px 9px;
  border: 1px solid var(--field-line);
  border-radius: 3px;
  background: #fbfaf5;
  color: #4d5446;
  font: inherit;
  cursor: pointer;
}
.field-sort select:focus-visible {
  outline: 2px solid #7c8d60;
  outline-offset: 3px;
}
.contender-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
}
.contender-grid > li {
  min-width: 0;
}
.contender-card {
  width: 100%;
  display: block;
  text-align: left;
  padding: 17px 17px 18px;
  border: 1px solid var(--field-line);
  border-radius: 4px;
  background: #faf9f4;
  color: var(--field-ink);
  transition:
    transform 0.22s ease,
    background 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;
}
.contender-card:hover {
  transform: translateY(-3px);
  border-color: #abb49b;
  box-shadow: 0 7px 15px #293c2910;
}
.contender-card.is-selected {
  border-color: #5a704d;
  background: #eeefe4;
  box-shadow: inset 0 0 0 1px #5a704d;
  transform: translateY(-2px);
}
.contender-topline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.contender-number {
  width: 26px;
  height: 27px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--runner-color);
  background: color-mix(in srgb, var(--runner-color) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--runner-color) 17%, transparent);
}
.contender-availability {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--field-muted);
  font-size: 7px;
  font-weight: 500;
  letter-spacing: 0.8px;
}
.contender-availability > span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #bbbdaf;
}
.is-in-race .contender-availability {
  color: #566b43;
}
.is-in-race .contender-availability > span {
  background: #7c905f;
}
.contender-arrow {
  margin-left: auto;
  color: #9ca48c;
  opacity: 0.35;
  transition:
    transform 0.22s,
    opacity 0.22s;
}
.contender-card:hover .contender-arrow,
.contender-card.is-selected .contender-arrow {
  opacity: 1;
  transform: translate(2px, -2px);
}
.contender-name {
  display: block;
  margin: 17px 0 20px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.contender-condition {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 9px;
  color: var(--field-muted);
}
.contender-condition > strong {
  color: #505a43;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.contender-condition small {
  margin-left: 2px;
  color: var(--field-muted);
  font-size: 8px;
  font-weight: 400;
}
.contender-meter {
  height: 2px;
}
.contender-meter > span {
  background: color-mix(in srgb, var(--runner-color) 35%, #b8bfa7);
}
.field-footnote {
  padding-top: 19px;
  font-size: 10px;
  line-height: 1.7;
  color: var(--field-muted);
}
@media (max-width: 1100px) {
  .contender-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .field-profile {
    grid-template-columns: 168px minmax(0, 1fr) 110px 150px;
    padding-right: 24px;
    gap: 17px;
  }
  .profile-art {
    transform: scale(0.85);
    transform-origin: left center;
  }
  .profile-follow {
    padding-inline: 12px;
    gap: 11px;
  }
}
@media (max-width: 800px) {
  .field-profile {
    grid-template-columns: 148px minmax(0, 1fr) 105px;
    padding: 0 20px 18px 6px;
    gap: 0 16px;
  }
  .profile-follow,
  .profile-resting {
    grid-column: 2 / -1;
    justify-self: start;
  }
  .profile-follow {
    margin-top: -9px;
  }
  .profile-resting {
    text-align: left;
    margin-top: -10px;
  }
  .profile-resting br {
    display: none;
  }
  .profile-art {
    grid-row: span 2;
    transform: scale(0.8);
  }
  .profile-condition {
    width: 90px;
  }
  .field-introduction {
    max-width: 210px;
  }
}
@media (max-width: 600px) {
  .field-explorer {
    padding-top: 32px;
  }
  .field-heading {
    display: block;
    margin-bottom: 20px;
  }
  .field-eyebrow {
    font-size: 8px;
    letter-spacing: 1.3px;
  }
  .field-heading h2 {
    font-size: 29px;
  }
  .field-introduction {
    text-align: left;
    max-width: none;
    margin-top: 10px;
    font-size: 10px;
  }
  .field-profile {
    grid-template-columns: 107px minmax(0, 1fr);
    gap: 0 12px;
    min-height: 198px;
    padding: 17px 16px 18px 5px;
  }
  .profile-art {
    grid-row: 1 / 4;
    width: 130px;
    min-height: 145px;
    transform: scale(0.65);
    transform-origin: left center;
  }
  .profile-identity h3 {
    font-size: 25px;
    margin-top: 6px;
    margin-bottom: 8px;
  }
  .profile-kicker {
    font-size: 7px;
    letter-spacing: 1.2px;
  }
  .profile-status {
    font-size: 9px;
  }
  .profile-condition {
    grid-column: 2;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    margin-top: 13px;
    gap: 6px 8px;
  }
  .profile-condition > div {
    margin: 0;
  }
  .profile-condition strong {
    font-family: inherit;
    font-size: 17px;
  }
  .profile-condition > div > span {
    font-size: 9px;
  }
  .profile-meter {
    grid-column: span 2;
  }
  .profile-follow {
    grid-column: 2;
    margin-top: 14px;
    padding: 8px 10px;
    font-size: 10px;
    width: 100%;
    justify-content: space-between;
  }
  .profile-resting {
    grid-column: 2;
    font-size: 9px;
    margin-top: 10px;
  }
  .field-toolbar {
    padding: 18px 0 16px;
    gap: 8px;
    align-items: flex-end;
  }
  .field-filters {
    gap: 15px;
  }
  .field-filters button {
    font-size: 10px;
    gap: 5px;
  }
  .field-filters button > span {
    font-size: 8px;
    padding: 1px 4px;
  }
  .field-sort > span {
    display: none;
  }
  .field-sort select {
    width: 87px;
    font-size: 10px;
    padding: 7px;
  }
  .contender-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }
  .contender-card {
    padding: 14px 13px 15px;
  }
  .contender-name {
    font-size: 12px;
    margin: 15px 0 18px;
  }
  .contender-topline {
    gap: 6px;
  }
  .contender-number {
    width: 24px;
    height: 25px;
  }
  .contender-availability {
    font-size: 6px;
    letter-spacing: 0.4px;
    gap: 3px;
  }
  .contender-arrow {
    width: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .contender-card,
  .contender-arrow,
  .profile-follow,
  .profile-meter > span,
  .contender-meter > span {
    transition: none;
  }
  .contender-card:hover,
  .contender-card.is-selected,
  .contender-card:hover .contender-arrow,
  .contender-card.is-selected .contender-arrow {
    transform: none;
  }
}
</style>
