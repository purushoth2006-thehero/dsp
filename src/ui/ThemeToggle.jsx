import { useEffect, useState } from 'react'
import { applyTheme, currentTheme, getSavedTheme, saveTheme, systemTheme } from '../theme.js'

// Switches between light and dark mode.
export default function ThemeToggle({ className = 'ghost light' }) {
  const [theme, setTheme] = useState(currentTheme)

  // Follow the device setting until the person makes their own choice.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return undefined
    const onChange = () => {
      if (getSavedTheme()) return
      const next = systemTheme()
      applyTheme(next)
      setTheme(next)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const dark = theme === 'dark'
  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    applyTheme(next)
    saveTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      className={`${className} theme-toggle`}
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
    </button>
  )
}
