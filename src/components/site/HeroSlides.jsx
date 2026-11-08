import { useEffect, useState } from 'react'
import { HERO_PHOTOS, preloadPhotos } from './photos.js'

// The photos behind the home page title; they fade into each other every 5 seconds.
// A photo that cannot load is skipped, and with none left the road picture (CSS background) shows.
// Only the previous, current and next photo are on the page at a time, so the others are not downloaded early.
export default function HeroSlides() {
  const [bad, setBad] = useState([])
  const [index, setIndex] = useState(0)
  const photos = HERO_PHOTOS.filter((p) => !bad.includes(p.src))
  const n = photos.length
  const current = n ? index % n : 0

  useEffect(() => {
    let live = true
    preloadPhotos().then((failed) => { if (live && failed.length) setBad((b) => [...new Set([...b, ...failed])]) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => setIndex((i) => i + 1), 5000)
    return () => clearInterval(id)
  }, [n])

  const shown = n ? [...new Set([(current + n - 1) % n, current, (current + 1) % n])] : []
  return (
    <div className="hero-slides" aria-hidden="true">
      {shown.map((i) => (
        <img
          key={photos[i].src} src={photos[i].src} alt="" referrerPolicy="no-referrer"
          className={i === current ? 'show' : ''}
          onError={() => setBad((b) => (b.includes(photos[i].src) ? b : [...b, photos[i].src]))}
        />
      ))}
    </div>
  )
}
