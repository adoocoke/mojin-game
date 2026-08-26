// 轻量合成音效（无需素材）
let ctx: AudioContext | null = null

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBurst(duration: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass') {
  const a = ac()
  const bufferSize = a.sampleRate * duration
  const buffer = a.createBuffer(1, bufferSize, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const g = a.createGain()
  g.gain.setValueAtTime(gain, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration)
  src.connect(filter).connect(g).connect(a.destination)
  src.start()
}

function tone(freq: number, duration: number, gain: number, type: OscillatorType = 'square', slide = 0) {
  const a = ac()
  const o = a.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, a.currentTime)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + duration)
  const g = a.createGain()
  g.gain.setValueAtTime(gain, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration)
  o.connect(g).connect(a.destination)
  o.start(); o.stop(a.currentTime + duration)
}

// ===== 环境风声（雪地图循环背景音） =====
let windSrc: AudioBufferSourceNode | null = null
let windGain: GainNode | null = null

export const sfx = {
  shot(big = false) { noiseBurst(big ? 0.28 : 0.14, big ? 900 : 1800, big ? 0.5 : 0.35); tone(big ? 90 : 140, 0.1, 0.2, 'triangle', -60) },
  enemyShot() { noiseBurst(0.12, 1200, 0.12) },
  hit() { tone(880, 0.06, 0.15, 'square', -200) },
  headshot() { tone(1320, 0.09, 0.2, 'square', -400) },
  hurt() { tone(180, 0.2, 0.25, 'sawtooth', -80) },
  reload() { tone(300, 0.08, 0.12, 'square'); setTimeout(() => tone(420, 0.08, 0.12, 'square'), 180) },
  kill() { tone(520, 0.12, 0.2, 'triangle', 300); setTimeout(() => tone(780, 0.14, 0.18, 'triangle'), 90) },
  pickup(rarityIdx = 0) { tone(440 + rarityIdx * 110, 0.1, 0.18, 'sine', 200); if (rarityIdx >= 3) setTimeout(() => tone(660 + rarityIdx * 110, 0.16, 0.18, 'sine'), 100) },
  search() { tone(220, 0.3, 0.08, 'sine', 60) },
  extract() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 0.2, 'sine'), i * 130)) },
  boom() { noiseBurst(0.55, 260, 0.55); tone(75, 0.5, 0.5, 'sine', -40); setTimeout(() => noiseBurst(0.3, 900, 0.2), 120) },
  dead() { [400, 300, 200, 120].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.2, 'sawtooth'), i * 160)) },
  ui() { tone(600, 0.04, 0.08, 'sine') },
  /** 开始风声（雪地图用），重复调用安全 */
  windStart() {
    if (windSrc) return
    try {
      const ctx = ac()
      const len = ctx.sampleRate * 3
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let last = 0
      for (let i = 0; i < len; i++) { // 棕色噪声更接近风
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      }
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true
      const filt = ctx.createBiquadFilter()
      filt.type = 'lowpass'; filt.frequency.value = 420
      const g = ctx.createGain()
      g.gain.value = 0.06
      // 音量缓慢起伏，模拟阵风
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.13
      const lfoG = ctx.createGain()
      lfoG.gain.value = 0.03
      lfo.connect(lfoG); lfoG.connect(g.gain)
      src.connect(filt); filt.connect(g); g.connect(ctx.destination)
      src.start(); lfo.start()
      src.onended = () => { try { lfo.stop() } catch { /* 忽略 */ } }
      windSrc = src; windGain = g
    } catch { /* 忽略 */ }
  },
  /** 停止风声 */
  windStop() {
    try { windSrc?.stop() } catch { /* 忽略 */ }
    try { windGain?.disconnect() } catch { /* 忽略 */ }
    windSrc = null; windGain = null
  },
  swing() { noiseBurst(0.09, 3600, 0.12); tone(260, 0.09, 0.07, 'sine', -160) },
  sell() { tone(988, 0.07, 0.16, 'sine'); setTimeout(() => tone(1319, 0.14, 0.16, 'sine'), 70) },
}
