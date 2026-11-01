<script setup lang="ts">
import { computed } from 'vue'
import type { Horse, RaceResult } from '../domain/race'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ result: RaceResult; horses: Horse[] }>()
const podium = computed(() =>
  props.result.entries.slice(0, 3).map((entry) => ({
    ...entry,
    horse: props.horses.find((horse) => horse.id === entry.horseId),
  })),
)
</script>

<template>
  <section class="race-podium" aria-label="Final round podium">
    <div class="podium-heading">
      <span><AppIcon name="trophy" :size="15" /> THE FINAL FINISH</span
      ><span>Round {{ result.roundId }} · {{ result.distance.toLocaleString('en-GB') }} m</span>
    </div>
    <ol class="podium-places">
      <li
        v-for="entry in podium"
        :key="entry.horseId"
        :class="{ 'podium-winner': entry.position === 1 }"
        :style="{ '--horse-color': entry.horse?.color, '--place': entry.position }"
      >
        <span class="podium-rank">{{ String(entry.position).padStart(2, '0') }}</span>
        <span class="podium-details"
          ><strong>{{ entry.horse?.name }}</strong
          ><small><span></span>{{ entry.time.toFixed(2) }} seconds</small></span
        >
      </li>
    </ol>
  </section>
</template>

<style scoped>
.race-podium {
  padding: 20px 22px 5px;
  animation: podium-reveal 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.podium-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #a3b99f;
  font-size: 9px;
  letter-spacing: 0.2px;
}
.podium-heading > span:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #d4edaa;
  font-size: 8px;
  letter-spacing: 1.2px;
  font-weight: 700;
}
.podium-places {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.podium-places li {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 10px;
  background: #dbe8cb09;
  border: 1px solid #dbe8cb18;
  border-radius: 8px;
  animation: podium-reveal 0.5s ease-out both;
  animation-delay: calc(var(--place) * 0.09s);
}
.podium-places .podium-winner {
  background: #d4edaa12;
  border-color: #d4edaa38;
}
.podium-rank {
  color: #879a7d;
  font-family: Georgia, serif;
  font-size: 26px;
  letter-spacing: -1px;
  line-height: 1;
}
.podium-winner .podium-rank {
  color: #d5edac;
}
.podium-details {
  min-width: 0;
}
.podium-details strong {
  display: block;
  color: #edeedc;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.podium-details small {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  color: #9cad91;
  font-size: 8px;
  font-variant-numeric: tabular-nums;
}
.podium-details small span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--horse-color);
}
@keyframes podium-reveal {
  from {
    opacity: 0;
    transform: translateY(9px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 700px) {
  .race-podium {
    padding: 17px 15px 3px;
  }
  .podium-places {
    gap: 5px;
  }
  .podium-places li {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 8px;
  }
  .podium-details {
    width: 100%;
  }
  .podium-details strong {
    font-size: 9px;
  }
  .podium-details small {
    font-size: 7px;
  }
  .podium-heading {
    font-size: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .race-podium,
  .podium-places li {
    animation: none;
  }
}
</style>
