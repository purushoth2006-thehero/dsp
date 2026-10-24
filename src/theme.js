// Light / dark mode. The choice is saved in this browser; until the person picks one, the device setting is used.
const KEY = 'dsp-theme'
const COLORS = { light: '#14304a', dark: '#0a1a2a' }

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

export const systemTheme = () =>
  (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme])
}

export function saveTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* private mode: the choice lasts until the page closes */ }
}

export const currentTheme = () => document.documentElement.dataset.theme || getSavedTheme() || systemTheme()
