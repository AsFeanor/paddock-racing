import { onBeforeUnmount, ref } from 'vue'

export type Theme = 'light' | 'dark'
const storageKey = 'paddock-theme'

export function useTheme() {
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  const theme = ref<Theme>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  let hasPreference = false
  try {
    hasPreference = ['light', 'dark'].includes(localStorage.getItem(storageKey) ?? '')
  } catch {
    /* Storage may be unavailable in private browsing. */
  }

  function apply(next: Theme) {
    theme.value = next
    const root = document.documentElement
    root.dataset.theme = next
    root.style.colorScheme = next
    root.style.backgroundColor = next === 'dark' ? '#101b18' : '#f5f4ee'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', root.style.backgroundColor)
  }

  function toggleTheme() {
    hasPreference = true
    apply(theme.value === 'dark' ? 'light' : 'dark')
    try {
      localStorage.setItem(storageKey, theme.value)
    } catch {
      /* The current session still keeps its theme. */
    }
  }

  function followSystem(event: MediaQueryListEvent) {
    if (!hasPreference) apply(event.matches ? 'dark' : 'light')
  }
  system.addEventListener('change', followSystem)
  onBeforeUnmount(() => system.removeEventListener('change', followSystem))
  return { theme, toggleTheme }
}
