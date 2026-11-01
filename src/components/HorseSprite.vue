<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ color?: string; moving?: boolean; variant?: number; label?: number | string }>(),
  { color: '#d6ec9c', moving: false, variant: 0 },
)
// CSS custom-property URLs resolve against the stylesheet, so anchor this to the page.
const spriteUrl = new URL(`${import.meta.env.BASE_URL}assets/horse-gallop.png`, document.baseURI).href
const spriteStyle = computed(() => ({
  '--silk-color': props.color,
  '--gallop-delay': `${-(props.variant % 4) * 0.14}s`,
  '--gallop-image': `url('${spriteUrl}')`,
}))
</script>

<template>
  <span
    class="horse-sprite"
    :class="{ 'is-moving': moving }"
    :style="spriteStyle"
    aria-hidden="true"
  >
    <span class="sprite-shadow"></span>
    <span class="sprite-dust"></span>
    <span class="sprite-frame"></span>
    <span v-if="label !== undefined" class="sprite-silk">{{ label }}</span>
  </span>
</template>

<style scoped>
.horse-sprite {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  isolation: isolate;
  pointer-events: none;
}
.sprite-frame {
  position: absolute;
  inset: 0;
  background-image: var(--gallop-image);
  background-repeat: no-repeat;
  background-size: 200% 200%;
  background-position: 0 0;
  filter: drop-shadow(0 4px 3px #020b0750);
  animation: gallop-frames 0.56s step-end infinite;
  animation-delay: var(--gallop-delay);
  animation-play-state: paused;
}
.sprite-shadow {
  position: absolute;
  width: 65%;
  height: 8%;
  left: 19%;
  bottom: 13%;
  border-radius: 50%;
  background: #020d0873;
  box-shadow: 0 0 8px var(--silk-color);
  opacity: 0.55;
  filter: blur(2px);
}
.sprite-silk {
  position: absolute;
  left: 51%;
  top: 55%;
  min-width: 13px;
  height: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  border-radius: 3px;
  background: var(--silk-color);
  color: #fff;
  text-shadow: 0 1px 2px #07130ab3;
  box-shadow: 0 1px 3px #0005;
  font:
    700 8px/1 'DM Sans',
    sans-serif;
  transform: translateX(-50%);
  z-index: 2;
  animation: silk-position 0.56s step-end infinite;
  animation-delay: var(--gallop-delay);
  animation-play-state: paused;
}
.sprite-dust {
  position: absolute;
  left: -8%;
  bottom: 15%;
  width: 29%;
  height: 6%;
  background: linear-gradient(90deg, transparent, #e8e4c37d);
  border-radius: 50%;
  opacity: 0;
  filter: blur(3px);
}
.is-moving .sprite-frame {
  animation-play-state: running;
}
.is-moving .sprite-silk {
  animation-play-state: running;
}
.is-moving .sprite-shadow {
  animation: ground-contact 0.28s ease-in-out infinite alternate;
}
.is-moving .sprite-dust {
  animation: dust-trail 0.65s ease-out infinite;
  animation-delay: var(--gallop-delay);
}
@keyframes gallop-frames {
  0% {
    background-position: 0 0;
  }
  25% {
    background-position: 100% 0;
  }
  50% {
    background-position: 0 100%;
  }
  75% {
    background-position: 100% 100%;
  }
  100% {
    background-position: 0 0;
  }
}
@keyframes ground-contact {
  to {
    transform: scaleX(0.8);
    opacity: 0.3;
  }
}
@keyframes silk-position {
  0%,
  25% {
    top: 55%;
  }
  50%,
  75% {
    top: 50%;
  }
  100% {
    top: 55%;
  }
}
@keyframes dust-trail {
  0% {
    transform: translateX(8px) scaleX(0.4);
    opacity: 0;
  }
  20% {
    opacity: 0.4;
  }
  100% {
    transform: translateX(-12px) scaleX(1.4);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sprite-frame,
  .sprite-silk,
  .is-moving .sprite-shadow,
  .is-moving .sprite-dust {
    animation: none;
  }
  .sprite-frame {
    background-position: 0 0;
  }
  .sprite-dust {
    display: none;
  }
}
</style>
