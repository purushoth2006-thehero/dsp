// Home page photos, loaded straight from Pexels (free to use). Add or remove lines to change the slideshow.
const px = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`

export const HERO_PHOTOS = [
  { src: px(11059352), alt: 'A white sedan driving on the road' },
  { src: px(11059356), alt: 'A white car driving on the road' },
  { src: px(9482560), alt: 'A white sedan moving on the road' },
]

// Loads every photo once. Resolves when each one has loaded or failed, or after 10 seconds, so the
// site never waits forever on a slow or blocked image. The result is remembered for the whole visit.
let preload
export function preloadPhotos(urls = HERO_PHOTOS.map((p) => p.src), timeoutMs = 10000) {
  preload ??= new Promise((resolve) => {
    const failed = new Set()
    let left = urls.length
    const done = () => { left -= 1; if (left <= 0) resolve([...failed]) }
    urls.forEach((src) => {
      const img = new Image()
      img.referrerPolicy = 'no-referrer'
      img.onload = done
      img.onerror = () => { failed.add(src); done() }
      img.src = src
    })
    setTimeout(() => resolve([...failed]), timeoutMs)
  })
  return preload
}
