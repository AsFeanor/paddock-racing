import { onMounted, onUnmounted } from 'vue'
import { useRaceStore } from '../stores/race'

/** Keep one animation loop; race state and simulation stay outside the browser clock. */
export function useRaceClock() {
  const race = useRaceStore()
  let frame = 0
  let previous: number | null = null

  function animate(timestamp: number) {
    if (previous !== null && race.status === 'running') race.tick((timestamp - previous) / 1000)
    previous = timestamp
    frame = requestAnimationFrame(animate)
  }

  function onVisibilityChange() {
    previous = null
    if (document.hidden && race.status === 'running') race.pause()
  }

  onMounted(() => {
    frame = requestAnimationFrame(animate)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onUnmounted(() => {
    cancelAnimationFrame(frame)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
