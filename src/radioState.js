import { useEffect, useRef, useState } from 'react'

export const SIZES = [2, 10, 10, 10, 4]
export const SHOW = [
  ['2', '3'],
  ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  ['.0', '.1', '.2', '.3', '.4', '.5', '.6', '.7', '.8', '.9'],
  ['00', '25', '50', '75'],
]
export const POWER = ['OFF', 'MAIN', 'BOTH', 'ADF']
export const MODE = ['MANUAL', 'PRESET', 'GUARD']
export const GUARD = '243.000'
const POWER_TEXT = [
  'Power off.',
  'Main receiver on, transmitter in standby.',
  'Main and guard receiver on, main transmitter in standby.',
  'Not used.',
]
const PRESETS = [
  '251.000', '255.400', '257.800', '262.500', '269.900', '275.700', '282.800', '289.400', '292.300', '299.500',
  '305.475', '311.000', '317.700', '327.500', '336.300', '343.800', '353.500', '364.900', '375.900', 'MWOD',
]

/* Control / Indicator -> Function (from the operating table) */
export const HINTS = {
  preset: 'PRESET: underneath the frequency card, held closed by a clip on the left, the pilot can preset 20 different frequency channels. Click to open or close.',
  card: 'Channel frequency card: provides space to record selected frequency. Click to close.',
  chanKnob: 'Channel selector knob: selects preset channel (1 to 20).',
  freq: 'Frequency selector: selects desired frequency.',
  mode: 'Mode selector. MANUAL: frequency selected with frequency selector knob. PRESET: selects preset channel as desired by CHAN selector. GUARD: frequency is automatically positioned to guard channel (243.00).',
  squelch: 'Squelch. OFF: received unsquelch. ON: received squelch operating.',
  vol: 'VOL knob: adjusts audio volume.',
  tone: 'TONE pushbutton: when pressed, audio tone indicates proper receiver performance. Hold to hear it.',
  uhf: 'UHF knob. OFF: power off. MAIN: main receiver on, transmitter in standby. BOTH: main and guard receiver on, main transmitter in standby. ADF: not used.',
  bw: 'BW switch: receiver bandwidth. WB: wide band. NB: narrow band. Click to switch (NB also lowers receiver noise).',
  sq: 'SQUELCH adjust (GD = guard receiver, MN = main receiver): screwdriver adjustment of the squelch threshold. Click to turn the slot.',
  load: 'PRESET pushbutton (red): loads the frequency set on the frequency switches into the selected preset channel. Needs the mode selector on PRESET. Channel 20 is reserved for MWOD operating mode data.',
  chanWin: 'CHAN window: indicates selected channel.',
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export function useRadioState() {
  const [digits, setDigits] = useState([1, 0, 5, 4, 3])   // 3 0 5 . 4 75
  const [chanTurn, setChanTurn] = useState(13)            // channel 14
  const [presets, setPresets] = useState(PRESETS)
  const [power, setPower] = useState(1)
  const [mode, setMode] = useState(0)
  const [squelch, setSquelch] = useState(true)
  const [vol, setVol] = useState(0.6)
  const [tone, setTone] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [hint, setHint] = useState(null)
  const [msg, setMsg] = useState('')
  const [bw, setBw] = useState('WB')
  const [sq, setSq] = useState({ GD: 2, MN: 2 })
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 5000); return () => clearTimeout(t) }, [msg])
  const audio = useRef(null)

  const ensureAudio = () => {
    if (audio.current) { audio.current.ctx.resume?.(); return }
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0
    noise.connect(noiseGain).connect(ctx.destination); noise.start()
    const osc = ctx.createOscillator(); osc.frequency.value = 1000
    const toneGain = ctx.createGain(); toneGain.gain.value = 0
    osc.connect(toneGain).connect(ctx.destination); osc.start()
    audio.current = { ctx, noiseGain, toneGain }
  }
  useEffect(() => () => audio.current?.ctx.close(), [])

  const chan = ((chanTurn % 20) + 20) % 20 + 1
  const rxOn = power === 1 || power === 2
  useEffect(() => {
    const a = audio.current
    if (!a) return
    const t = a.ctx.currentTime
    a.noiseGain.gain.setTargetAtTime(rxOn && !squelch ? vol * 0.08 * (bw === 'NB' ? 0.6 : 1) : 0, t, 0.02)   // unsquelched receiver noise
    a.toneGain.gain.setTargetAtTime(rxOn && tone ? vol * 0.25 : 0, t, 0.01)        // TONE pushbutton
  }, [rxOn, squelch, vol, tone, bw])

  const manualFreq = `${SHOW[0][digits[0]]}${digits[1]}${digits[2]}${SHOW[3][digits[3]]}${SHOW[4][digits[4]]}`
  const activeFreq = power === 0 ? null : mode === 0 ? manualFreq : mode === 1 ? presets[chan - 1] : GUARD
  const inRange = (f) => parseFloat(f) >= 225 && parseFloat(f) <= 399.975

  const act = (fn) => (...a) => { ensureAudio(); fn(...a) }
  return {
    digits, chan, chanTurn, presets, power, mode, squelch, vol, tone, coverOpen, hint, setHint,
    manualFreq, activeFreq, rxOn, bw, sq, inRange: activeFreq && activeFreq !== 'MWOD' ? inRange(activeFreq) : true, msg,
    powerText: POWER_TEXT[power],
    stepDigit: act((i, dir) => setDigits((p) => p.map((v, k) => (k === i ? (v + dir + SIZES[k]) % SIZES[k] : v)))),
    turnChan: act((dir) => setChanTurn((t) => t + dir)),
    stepPower: act((dir) => setPower((p) => clamp(p + dir, 0, 3))),
    stepMode: act((dir) => setMode((m) => clamp(m + dir, 0, 2))),
    stepVol: act((dir) => setVol((v) => clamp(Math.round((v + dir * 0.1) * 10) / 10, 0, 1))),
    toggleBw: act(() => setBw((b) => (b === 'WB' ? 'NB' : 'WB'))),
    stepSq: act((k) => setSq((q) => ({ ...q, [k]: (q[k] + 1) % 5 }))),
    toggleSquelch: act(() => setSquelch((s) => !s)),
    pressTone: act((on) => setTone(on)),
    toggleCover: act(() => setCoverOpen((o) => !o)),
    loadPreset: act(() => {
      if (mode !== 1) return setMsg('Not loaded: set the mode selector to PRESET first.')
      if (chan === 20) return setMsg('Not loaded: channel 20 is reserved for MWOD operating mode data.')
      if (!inRange(manualFreq)) return setMsg(`Not loaded: ${manualFreq} is outside 225.000 to 399.975 MHz.`)
      setPresets((p) => p.map((f, i) => (i === chan - 1 ? manualFreq : f)))
      setMsg(`Loaded ${manualFreq} MHz into channel ${chan}.`)
    }),
  }
}
