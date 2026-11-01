<script setup lang="ts">
import type { Horse } from '../domain/race'
defineProps<{ horses: Horse[]; activeIds: string[] }>()
</script>

<template>
  <section class="panel roster" aria-labelledby="roster-title">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">MEET THE FIELD</span>
        <h2 id="roster-title">
          The paddock <span class="count">{{ horses.length }}</span>
        </h2>
        <p class="panel-subtitle">Twenty runners. Endless possibility.</p>
      </div>
    </div>
    <div class="roster-labels"><span>RUNNER</span><span>CONDITION</span></div>
    <ol class="horse-list" role="list">
      <li
        v-for="(horse, index) in horses"
        :key="horse.id"
        :class="{ selected: activeIds.includes(horse.id) }"
        :style="{ '--horse-color': horse.color }"
      >
        <span class="roster-number roster-number-badge" aria-hidden="true">{{
          String(index + 1).padStart(2, '0')
        }}</span>
        <span class="horse-identity">
          <span class="horse-name" :title="horse.name">{{ horse.name }}</span>
          <span
            v-if="activeIds.includes(horse.id)"
            class="roster-selection"
            aria-label="Selected for the current round"
          ></span>
        </span>
        <span
          class="condition"
          :class="{
            strong: horse.condition >= 75,
            steady: horse.condition >= 40 && horse.condition < 75,
          }"
          :aria-label="`Condition ${horse.condition} out of 100`"
          :title="`Condition: ${horse.condition} / 100`"
        >
          <span class="condition-meter" aria-hidden="true"
            ><span :style="{ width: `${horse.condition}%` }"></span
          ></span>
          <span class="condition-score">{{ horse.condition }}</span>
        </span>
      </li>
    </ol>
    <div class="roster-note">
      <span class="selection-dot"></span>
      <span class="roster-caption">{{
        activeIds.length
          ? `${activeIds.length} runners selected for this round`
          : 'Your line-up is waiting to be drawn'
      }}</span>
    </div>
  </section>
</template>

<style scoped>
.panel-subtitle {
  margin-top: 8px;
  color: var(--muted, #6f7a6e);
  font-size: 11px;
  line-height: 1.5;
}
.roster-number-badge {
  width: 27px;
  height: 27px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 7px;
  color: var(--horse-color);
  background: color-mix(in srgb, var(--horse-color) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--horse-color) 19%, transparent);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.horse-identity {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
}
.horse-identity .horse-name {
  flex: 0 1 auto;
}
.roster-selection {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #668f46;
  flex-shrink: 0;
}
.condition-score {
  min-width: 19px;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.condition.strong .condition-score {
  color: #426c34;
}
.roster-caption {
  line-height: 1.5;
}
@media (max-width: 700px) {
  .roster-number-badge {
    width: 25px;
    height: 25px;
    border-radius: 6px;
  }
}
</style>
