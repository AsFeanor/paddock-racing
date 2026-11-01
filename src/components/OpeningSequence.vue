<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ reveal: []; complete: [restoreFocus: boolean] }>()
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
const visible = ref(!motionPreference.matches)
const revealing = ref(false)
const imageAvailable = ref(true)
const skipButton = ref<HTMLButtonElement>()
const heroUrl = `${import.meta.env.BASE_URL}assets/race-hero.png`
const letters = [...'paddock.']
const timers: number[] = []
let revealed = false
let completed = false

function reveal() {
  if (revealed) return
  revealed = true
  revealing.value = true
  emit('reveal')
}

function complete(restoreFocus = false) {
  if (completed) return
  completed = true
  timers.forEach(window.clearTimeout)
  reveal()
  visible.value = false
  emit('complete', restoreFocus)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !completed) {
    event.preventDefault()
    complete(true)
  }
}

function onMotionPreferenceChange(event: MediaQueryListEvent) {
  if (event.matches) complete()
}

onMounted(() => {
  if (motionPreference.matches) {
    complete()
    return
  }
  skipButton.value?.focus({ preventScroll: true })
  window.addEventListener('keydown', onKeydown)
  motionPreference.addEventListener('change', onMotionPreferenceChange)
  timers.push(window.setTimeout(reveal, 1650), window.setTimeout(complete, 2600))
})

onBeforeUnmount(() => {
  timers.forEach(window.clearTimeout)
  window.removeEventListener('keydown', onKeydown)
  motionPreference.removeEventListener('change', onMotionPreferenceChange)
})
</script>

<template>
  <div
    v-if="visible"
    class="opening-sequence"
    :class="{ 'opening-sequence--revealing': revealing }"
    role="region"
    aria-label="Welcome to Paddock"
  >
    <div class="opening-art" aria-hidden="true">
      <img
        v-if="imageAvailable"
        :src="heroUrl"
        alt=""
        fetchpriority="high"
        @error="imageAvailable = false"
      />
    </div>
    <div class="opening-shade" aria-hidden="true"></div>
    <div class="opening-frame" aria-hidden="true"></div>
    <div class="opening-topline" aria-hidden="true">
      <span>THE VIRTUAL RACING CLUB</span>
      <span>VOL. 01 <i></i> THE CLASSIC</span>
    </div>
    <div class="opening-content" aria-hidden="true">
      <div class="opening-kicker"><span></span>THE PADDOCK CLASSIC</div>
      <div class="opening-wordmark">
        <span
          v-for="(letter, index) in letters"
          :key="index"
          :class="{ 'opening-dot': letter === '.' }"
          :style="{ '--letter-delay': `${180 + index * 55}ms` }"
          >{{ letter }}</span
        >
      </div>
      <div class="opening-rule"><span></span></div>
      <p class="opening-tagline">A little chance. <em>A beautiful race.</em></p>
      <div class="opening-details"><span>20 CONTENDERS</span><i></i><span>06 ROUNDS</span></div>
    </div>
    <div class="opening-bottomline" aria-hidden="true">
      <span>THE SPORT OF POSSIBILITY</span><span>YOUR FRONT-ROW SEAT AWAITS</span>
    </div>
    <button ref="skipButton" class="opening-skip" type="button" @click="complete(true)">
      Skip intro <AppIcon name="arrow" :size="14" />
    </button>
  </div>
</template>

<style scoped>
.opening-sequence {
  position: fixed;
  inset: 0;
  z-index: 1000;
  isolation: isolate;
  overflow: hidden;
  background: #101f19;
  color: #f1eedf;
  clip-path: inset(0 0 0 0);
  will-change: clip-path;
  transition: clip-path 950ms cubic-bezier(0.76, 0, 0.24, 1);
}
.opening-sequence--revealing {
  clip-path: inset(0 0 100% 0);
  pointer-events: none;
}
.opening-art,
.opening-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.opening-art {
  left: 28%;
  width: 78%;
  overflow: hidden;
  mask-image: linear-gradient(115deg, transparent 0%, #000 31%, #000 100%);
  opacity: 0;
  animation: opening-art-arrive 1.15s 80ms ease-out forwards;
}
.opening-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 72% 40%;
  filter: saturate(0.7) brightness(0.66);
  animation: opening-art-drift 3.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.opening-shade {
  background:
    linear-gradient(90deg, #101f19 0%, #101f19bb 27%, #101f191a 65%, #101f1929),
    linear-gradient(180deg, #101f1933, transparent 35%, #101f1900 55%, #101f19d9);
}
.opening-frame {
  position: absolute;
  inset: 24px;
  border: 1px solid #d8d3ae18;
  pointer-events: none;
  opacity: 0;
  animation: opening-soft-in 850ms 250ms ease-out forwards;
}
.opening-topline,
.opening-bottomline {
  position: absolute;
  left: clamp(35px, 6vw, 100px);
  right: clamp(35px, 6vw, 100px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  font:
    400 8px/1.4 'DM Sans',
    sans-serif;
  letter-spacing: 2px;
  color: #cecdb68c;
  opacity: 0;
  animation: opening-soft-in 700ms 450ms ease-out forwards;
}
.opening-topline {
  top: 53px;
}
.opening-topline > span:last-child,
.opening-details {
  display: flex;
  align-items: center;
  gap: 14px;
}
.opening-topline i,
.opening-details i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.55;
}
.opening-bottomline {
  bottom: 52px;
  right: max(210px, 17vw);
  font-size: 7px;
  letter-spacing: 1.7px;
  color: #bbbfa077;
}
.opening-content {
  position: absolute;
  left: clamp(35px, 9vw, 150px);
  top: 50%;
  transform: translateY(-45%);
  max-width: calc(100% - 70px);
}
.opening-kicker {
  display: flex;
  align-items: center;
  gap: 12px;
  font:
    400 9px/1.4 'DM Sans',
    sans-serif;
  letter-spacing: 3.3px;
  color: #c7c2a6;
  opacity: 0;
  animation: opening-copy-arrive 800ms 100ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.opening-kicker > span {
  width: 33px;
  height: 1px;
  background: #bfbb91;
}
.opening-wordmark {
  display: flex;
  align-items: baseline;
  overflow: hidden;
  margin: 14px 0 0 -7px;
  padding: 0 4px 20px 0;
  font:
    500 clamp(80px, 13vw, 200px)/1.1 'Playfair Display',
    Georgia,
    serif;
  letter-spacing: -0.075em;
  color: #f2eedc;
}
.opening-wordmark > span {
  display: block;
  opacity: 0;
  transform: translateY(110%);
  animation: opening-letter-arrive 1.1s var(--letter-delay) cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.opening-wordmark > .opening-dot {
  color: #c9b97f;
  margin-left: 2px;
}
.opening-rule {
  width: min(510px, 45vw);
  height: 1px;
  background: #e7e3c412;
  overflow: hidden;
  margin: 7px 0 24px;
}
.opening-rule > span {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #c6bb88b3, #c6bb881a);
  transform: scaleX(0);
  transform-origin: left;
  animation: opening-rule-arrive 1.1s 450ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.opening-tagline {
  font:
    500 clamp(19px, 2vw, 29px)/1.4 'Playfair Display',
    Georgia,
    serif;
  letter-spacing: -0.5px;
  color: #e4dfc9;
  opacity: 0;
  animation: opening-copy-arrive 850ms 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.opening-tagline em {
  color: #c1c79b;
}
.opening-details {
  margin-top: 22px;
  font:
    400 7px/1.4 'DM Sans',
    sans-serif;
  letter-spacing: 2px;
  color: #c5c6aa87;
  opacity: 0;
  animation: opening-copy-arrive 750ms 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.opening-skip {
  position: absolute;
  right: clamp(35px, 6vw, 100px);
  bottom: 38px;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 10px 0 10px 16px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #dad5b73d;
  color: #d9d7c0;
  font:
    400 10px/1.4 'DM Sans',
    sans-serif;
  letter-spacing: 0.4px;
  cursor: pointer;
  transition:
    color 180ms,
    border-color 180ms;
}
.opening-skip:hover {
  color: #fffbee;
  border-color: #dad5b791;
}
.opening-skip:focus-visible {
  outline: 2px solid #c9b97f;
  outline-offset: 6px;
  border-radius: 2px;
}
@keyframes opening-letter-arrive {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes opening-copy-arrive {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes opening-rule-arrive {
  to {
    transform: scaleX(1);
  }
}
@keyframes opening-soft-in {
  to {
    opacity: 1;
  }
}
@keyframes opening-art-arrive {
  to {
    opacity: 0.92;
  }
}
@keyframes opening-art-drift {
  from {
    transform: scale(1.14) translateX(2%);
  }
  to {
    transform: scale(1.02) translateX(0);
  }
}
@media (max-width: 700px) {
  .opening-frame {
    inset: 15px;
  }
  .opening-topline {
    top: 35px;
    left: 30px;
    right: 30px;
    font-size: 6px;
    letter-spacing: 1.4px;
  }
  .opening-topline > span:last-child {
    gap: 9px;
  }
  .opening-content {
    left: 30px;
    max-width: calc(100% - 60px);
    transform: translateY(-35%);
  }
  .opening-art {
    left: -8%;
    width: 130%;
    mask-image: linear-gradient(135deg, transparent, #000 45%);
  }
  .opening-art img {
    object-position: 63% 40%;
    filter: saturate(0.7) brightness(0.46);
  }
  .opening-shade {
    background:
      linear-gradient(90deg, #101f19b8, #101f193d),
      linear-gradient(180deg, #101f1933, transparent 28%, #101f1970 60%, #101f19);
  }
  .opening-kicker {
    font-size: 6.5px;
    letter-spacing: 2.3px;
    gap: 9px;
  }
  .opening-kicker > span {
    width: 23px;
  }
  .opening-wordmark {
    font-size: clamp(75px, 19.8vw, 138px);
    letter-spacing: -0.075em;
    margin-left: -4px;
    padding-bottom: 15px;
  }
  .opening-rule {
    width: 100%;
    margin: 7px 0 20px;
  }
  .opening-tagline {
    font-size: clamp(18px, 4.5vw, 26px);
    letter-spacing: -0.45px;
  }
  .opening-tagline em {
    display: block;
    margin-top: 4px;
  }
  .opening-details {
    font-size: 6px;
    letter-spacing: 1.7px;
    margin-top: 19px;
  }
  .opening-bottomline {
    left: 30px;
    right: 150px;
    bottom: 42px;
    font-size: 6px;
    letter-spacing: 1.4px;
  }
  .opening-bottomline > span:last-child {
    display: none;
  }
  .opening-skip {
    right: 30px;
    bottom: 28px;
    font-size: 9px;
    gap: 12px;
  }
}
@media (max-height: 500px) and (min-width: 701px) {
  .opening-content {
    transform: translateY(-40%);
  }
  .opening-wordmark {
    font-size: 90px;
    padding-bottom: 10px;
  }
  .opening-rule {
    margin: 0 0 12px;
  }
  .opening-details {
    margin-top: 12px;
  }
  .opening-tagline {
    font-size: 20px;
  }
  .opening-topline {
    top: 30px;
  }
  .opening-bottomline {
    bottom: 30px;
  }
  .opening-skip {
    bottom: 19px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .opening-sequence {
    display: none;
    transition: none;
  }
  .opening-sequence * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
