import { useEffect, useState } from 'react'

export default function SiteLoader() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return (
    <div className="site-loader" role="status" aria-live="polite">
      <img src="/logo.png" alt="" width="84" height="84" />
      <p className="loader-title">Sridhar Driving School</p>
      <p className="loader-text">{online ? 'Loading…' : 'No internet connection. Waiting for the network…'}</p>
      <div className="loader-lane" aria-hidden="true" />
    </div>
  )
}
