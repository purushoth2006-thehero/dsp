// A simple engine sound made in the browser: the pitch follows the engine speed. Nothing is downloaded.
export function createEngine() {
  let ctx = null
  let osc = null
  let sub = null
  let filter = null
  let gain = null
  let muted = false
  return {
    start() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC || ctx) return
        ctx = new AC()
        osc = ctx.createOscillator(); osc.type = 'sawtooth'
        sub = ctx.createOscillator(); sub.type = 'square'
        filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 400
        gain = ctx.createGain(); gain.gain.value = 0
        osc.connect(filter); sub.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
        osc.start(); sub.start()
      } catch { ctx = null }
    },
    // rpm 0..1, throttle 0..1
    set(rpm, throttle) {
      if (!ctx) return
      const t = ctx.currentTime
      const f = 34 + rpm * 120
      osc.frequency.setTargetAtTime(f, t, 0.05)
      sub.frequency.setTargetAtTime(f / 2, t, 0.05)
      filter.frequency.setTargetAtTime(260 + rpm * 700 + throttle * 500, t, 0.08)
      gain.gain.setTargetAtTime(muted ? 0 : 0.03 + throttle * 0.045, t, 0.08)
    },
    setMuted(m) { muted = m; if (ctx && m) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03) },
    stop() {
      try { if (ctx) { osc.stop(); sub.stop(); ctx.close() } } catch { /* already closed */ }
      ctx = null
    },
  }
}
