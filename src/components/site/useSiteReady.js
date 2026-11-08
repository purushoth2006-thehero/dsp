import { useEffect, useState } from 'react'
import { preloadPhotos } from './photos.js'

// The site opens only after the page and its photos have loaded. A visit remembers that it is ready,
// so moving between pages never shows the loading screen again.
let ready = false

export default function useSiteReady() {
  const [isReady, setReady] = useState(ready)
  useEffect(() => {
    if (ready) return undefined
    let live = true
    const pageLoaded = new Promise((resolve) => {
      if (document.readyState === 'complete') resolve()
      else window.addEventListener('load', resolve, { once: true })
    })
    // Wait for the page and the photos, but never longer than 12 seconds.
    Promise.race([Promise.all([pageLoaded, preloadPhotos()]), new Promise((r) => setTimeout(r, 12000))]).then(() => {
      ready = true
      if (live) setReady(true)
    })
    return () => { live = false }
  }, [])
  return isReady
}
