import { useEffect, useState } from 'react'
import { HERO_PHOTOS, preloadPhotos } from './photos.js'

// The photos behind the home page title; they fade into each other every 5 seconds.
// A photo that could not load is skipped, and with none left the road picture (CSS background) shows.
export default function HeroSlides() {
  const [photos, setPhotos] = useState(HERO_PHOTOS)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let live = true
    preloadPhotos().then((failed) => { if (live) setPhotos(HERO_PHOTOS.filter((p) => !failed.includes(p.src))) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), 5000)
    return () => clearInterval(id)
  }, [photos])

  return (
    <div className="hero-slides" aria-hidden="true">
      {photos.map((p, i) => (
        <img key={p.src} src={p.src} alt="" referrerPolicy="no-referrer" className={i === index % photos.length ? 'show' : ''} />
      ))}
    </div>
  )
}
