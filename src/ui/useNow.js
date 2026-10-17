import { useEffect, useState } from 'react'

// The current time, refreshed every minute so "upcoming" and "past" stay correct on a page left open.
export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
