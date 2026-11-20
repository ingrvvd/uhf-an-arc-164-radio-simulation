import { MODE, POWER } from './radioState.js'

const box = { position: 'fixed', font: '13px/1.45 system-ui, sans-serif', color: '#222' }
export default function Overlay({ rd }) {
  const row = (k, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#777' }}>{k}</span><span>{v}</span>
    </div>
  )
  return (
    <>
      <div style={{ ...box, left: 16, top: 16, width: 270, padding: 14, background: '#f3f3f1',
        border: '1px solid #d8d8d4', borderRadius: 6 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>AN/ARC-164 UHF</div>
        <div style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
          {rd.activeFreq ? rd.activeFreq : '- - -'} <span style={{ fontSize: 13 }}>MHz</span>
        </div>
        {!rd.inRange && <div style={{ color: '#b3261e' }}>Outside 225.000 to 399.975 MHz</div>}
        <div style={{ height: 8 }} />
        {row('UHF knob', POWER[rd.power])}
        {row('Mode', MODE[rd.mode])}
        {row('CHAN', rd.chan)}
        {row('Squelch', rd.squelch ? 'ON' : 'OFF')}
        {row('Bandwidth', rd.bw === 'WB' ? 'WB (wide)' : 'NB (narrow)')}
        {row('Squelch adj GD / MN', `${rd.sq.GD} / ${rd.sq.MN}`)}
        {row('Volume', Math.round(rd.vol * 100) + '%')}
        <div style={{ color: '#555', margin: '8px 0' }}>{rd.powerText}</div>
        <div style={{ borderTop: '1px solid #d8d8d4', paddingTop: 8, color: '#555' }}>
          To preset: set mode to PRESET, set the frequency with the five drums, turn CHAN to the channel
          (20 is reserved for MWOD), open the lid and press the red PRESET button.
        </div>
        {rd.msg && <div style={{ marginTop: 6, fontWeight: 600 }}>{rd.msg}</div>}
      </div>
      <div style={{ ...box, left: 0, right: 0, bottom: 14, textAlign: 'center', padding: '0 24px',
        color: rd.hint ? '#222' : '#777', pointerEvents: 'none' }}>
        {rd.hint || 'Hover a control to see its function. Click the right half of a knob to turn it clockwise, the left half to turn it anticlockwise.'}
      </div>
    </>
  )
}
