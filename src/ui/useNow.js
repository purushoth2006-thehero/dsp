import { useEffect, useState } from 'react'
import { nowInZone } from '../rules.js'

// The current time at the school (India), refreshed every minute so "upcoming" and "past"
// stay correct on a page left open, whatever time zone the visitor's computer is set to.
export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => nowInZone())
  useEffect(() => {
    const timer = setInterval(() => setNow(nowInZone()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
