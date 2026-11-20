import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SIZES, SHOW, HINTS } from './radioState.js'

/* All layout numbers are pixel coordinates of the 560x560 reference photo.
   X()/Y() convert them to world units (1 unit = 100 px, origin = image centre). */
const X = (p) => (p - 285) / 100
const Y = (p) => (285 - p) / 100

const C = {
  lower: '#16171a', band: '#18191b', upper: '#1e1f21', cover: '#1f2022',
  boss: '#101113', knob: '#8d9091', knobDark: '#777a7b', screw: '#202122',
  white: '#f1f1ee', uhf: '#d4a23a',
}
const pointer = { onPointerOver: () => (document.body.style.cursor = 'pointer'),
                  onPointerOut: () => (document.body.style.cursor = 'auto') }

/* ---------- primitives ---------- */
function Box({ x0, y0, x1, y1, z0 = -0.4, z1, color, r = 0.03, rough = 0.72 }) {
  const w = (x1 - x0) / 100, h = (y1 - y0) / 100, d = z1 - z0
  return (
    <RoundedBox args={[w, h, d]} radius={Math.min(r, d / 2 - 0.001)} smoothness={3}
      position={[X((x0 + x1) / 2), Y((y0 + y1) / 2), (z0 + z1) / 2]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={rough} metalness={0.12} />
    </RoundedBox>
  )
}

function Cyl({ x, y, z0, z1, r, color, rough = 0.6, seg = 48 }) {
  return (
    <mesh position={[X(x), Y(y), (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[r / 100, r / 100, z1 - z0, seg]} />
      <meshStandardMaterial color={color} roughness={rough} metalness={0.15} />
    </mesh>
  )
}

function Label({ x, y, z, text, w = 80, h = 24, size = 12, color = C.white, weight = 700 }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w * 4; c.height = h * 4
    const g = c.getContext('2d')
    g.scale(4, 4)
    g.fillStyle = color
    g.font = `${weight} ${size}px Arial, Helvetica, sans-serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, w / 2, h / 2 + 1)
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text, w, h, size, color, weight])
  return (
    <mesh position={[X(x), Y(y), z]}>
      <planeGeometry args={[w / 100, h / 100]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

function Screw({ x, y, z, r = 12, rot = 0.6 }) {
  return (
    <group position={[X(x), Y(y), z]} rotation={[0, 0, rot]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r / 100, r / 100, 0.1, 6]} />
        <meshStandardMaterial color={C.screw} roughness={0.45} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[(r * 1.5) / 100, 0.025, 0.02]} />
        <meshStandardMaterial color="#060606" />
      </mesh>
    </group>
  )
}

/* Paddle-shaped lever knob: a round body with a tapered lobe (pointer) on top. */
function lobeShape(r, tip) {
  const s = new THREE.Shape()
  const a = 0.95, start = Math.PI / 2 + a, end = Math.PI / 2 - a + Math.PI * 2
  s.absarc(0, 0, r, start, end, false)
  const ex = r * Math.cos(Math.PI / 2 - a)
  s.bezierCurveTo(ex * 0.95, r * tip * 0.85, ex * 0.5, r * tip, 0, r * tip)
  s.bezierCurveTo(-ex * 0.5, r * tip, -ex * 0.95, r * tip * 0.85, -ex, r * Math.sin(Math.PI / 2 - a))
  return s
}

function Knob({ x, y, z, r, h = 0.22, rot = 0, tip = 1.5, step = 30, color = C.knob }) {
  const g = useRef()
  const [n, setN] = useState(0)
  const shape = useMemo(() => lobeShape(r / 100, tip), [r, tip])
  useFrame((_, dt) => {
    const t = ((rot - n * step) * Math.PI) / 180
    g.current.rotation.z += (t - g.current.rotation.z) * Math.min(1, dt * 12)
  })
  return (
    <group ref={g} position={[X(x), Y(y), z]}
      onClick={(e) => { e.stopPropagation(); setN(n + 1) }} {...pointer}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: h, bevelEnabled: true, bevelThickness: 0.025,
          bevelSize: 0.02, bevelSegments: 4, curveSegments: 48 }]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, h + 0.026]}>
        <circleGeometry args={[(r / 100) * 0.6, 48]} />
        <meshStandardMaterial color={C.knobDark} roughness={0.6} transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

/* Lever knob driven by state: `angle` in degrees, onTurn(+1) = clockwise, onTurn(-1) = anticlockwise. */
function ControlKnob({ x, y, z, r, h = 0.22, tip = 1.5, angle = 0, onTurn, hover }) {
  const g = useRef()
  const shape = useMemo(() => lobeShape(r / 100, tip), [r, tip])
  useFrame((_, dt) => {
    g.current.rotation.z += ((angle * Math.PI) / 180 - g.current.rotation.z) * Math.min(1, dt * 14)
  })
  return (
    <group ref={g} position={[X(x), Y(y), z]} {...(hover || pointer)}
      onClick={(e) => {
        e.stopPropagation()
        const p = g.current.parent.worldToLocal(e.point.clone())
        onTurn(e.shiftKey || p.x < g.current.position.x ? -1 : 1)
      }}
      onContextMenu={(e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); onTurn(-1) }}
      onWheel={(e) => { e.stopPropagation(); onTurn(e.deltaY < 0 ? 1 : -1) }}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: h, bevelEnabled: true, bevelThickness: 0.025,
          bevelSize: 0.02, bevelSegments: 4, curveSegments: 48 }]} />
        <meshStandardMaterial color={C.knob} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, h + 0.026]}>
        <circleGeometry args={[(r / 100) * 0.6, 48]} />
        <meshStandardMaterial color={C.knobDark} roughness={0.6} transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

/* Knurled volume knob, vol 0..1 sweeps 270 degrees. */
function VolKnob({ x, y, z, r, vol, onTurn, hover }) {
  const g = useRef()
  useFrame((_, dt) => {
    const t = ((135 - vol * 270) * Math.PI) / 180
    g.current.rotation.z += (t - g.current.rotation.z) * Math.min(1, dt * 12)
  })
  const ridges = useMemo(() => Array.from({ length: 40 }, (_, i) => i), [])
  const R = r / 100
  return (
    <group ref={g} position={[X(x), Y(y), z]} {...(hover || pointer)}
      onClick={(e) => {
        e.stopPropagation()
        const p = g.current.parent.worldToLocal(e.point.clone())
        onTurn(e.shiftKey || p.x < g.current.position.x ? -1 : 1)
      }}
      onContextMenu={(e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); onTurn(-1) }}
      onWheel={(e) => { e.stopPropagation(); onTurn(e.deltaY < 0 ? 1 : -1) }}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]} castShadow>
        <cylinderGeometry args={[R, R, 0.2, 64]} />
        <meshStandardMaterial color={C.knob} roughness={0.5} metalness={0.15} />
      </mesh>
      {ridges.map((i) => {
        const a = (i / 40) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0.1]} rotation={[0, 0, a]}>
            <boxGeometry args={[0.025, 0.028, 0.2]} />
            <meshStandardMaterial color={C.knobDark} roughness={0.6} />
          </mesh>
        )
      })}
      <mesh position={[0, 0, 0.203]}>
        <circleGeometry args={[R * 0.82, 48]} />
        <meshStandardMaterial color="#979a9b" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, R * 0.45, 0.21]}>
        <boxGeometry args={[0.025, R * 0.8, 0.012]} />
        <meshBasicMaterial color="#f4f4f2" toneMapped={false} />
      </mesh>
    </group>
  )
}

/* Squelch toggle: lever tilts left (OFF) or right (ON). */
function Toggle({ x, y, z, on, onToggle, hover }) {
  const g = useRef()
  useFrame((_, dt) => {
    const t = on ? 0.55 : -0.55
    g.current.rotation.y += (t - g.current.rotation.y) * Math.min(1, dt * 14)
  })
  return (
    <group position={[X(x), Y(y), z]} onClick={(e) => { e.stopPropagation(); onToggle() }} {...(hover || pointer)}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 6]} />
        <meshStandardMaterial color="#3a3b3c" roughness={0.35} metalness={0.7} />
      </mesh>
      <group ref={g} position={[0, 0, 0.06]}>
        <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.04, 0.22, 16]} />
          <meshStandardMaterial color="#9a9c9d" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

/* TONE pushbutton: depresses and lights while held. */
function ToneButton({ x, y, z, onDown, onUp, hover, cap = '#fbfbf7', glow = true, ring = '#2b2c2d', hex = false, s = 1 }) {
  const [p, setP] = useState(false)
  const up = () => { if (p) { setP(false); onUp() } }
  return (
    <group position={[X(x), Y(y), z]} scale={[s, s, 1]} {...(hover || pointer)}
      onPointerDown={(e) => { e.stopPropagation(); setP(true); onDown() }}
      onPointerUp={up}
      onPointerOut={(e) => { up(); hover?.onPointerOut?.(e) }}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.025]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.05, hex ? 6 : 32]} />
        <meshStandardMaterial color={ring} roughness={0.35} metalness={hex ? 0.8 : 0.3} />
      </mesh>
      <mesh position={[0, 0, p ? 0.03 : 0.06]}>
        <sphereGeometry args={[0.075, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={cap} emissive="#ffffff" emissiveIntensity={glow ? (p ? 1.2 : 0.3) : 0} roughness={0.3} />
      </mesh>
    </group>
  )
}

/* Slotted screwdriver adjuster in a hex nut. */
function Adjuster({ x, y, z, r, angle, onClick, hover }) {
  const g = useRef()
  useFrame((_, dt) => {
    g.current.rotation.z += ((angle * Math.PI) / 180 - g.current.rotation.z) * Math.min(1, dt * 12)
  })
  const R = r / 100
  return (
    <group position={[X(x), Y(y), z]} onClick={(e) => { e.stopPropagation(); onClick() }} {...(hover || pointer)}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.04]} castShadow>
        <cylinderGeometry args={[R, R, 0.08, 6]} />
        <meshStandardMaterial color="#a9abac" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.09]}>
        <cylinderGeometry args={[R * 0.62, R * 0.62, 0.04, 32]} />
        <meshStandardMaterial color="#b4b6b7" roughness={0.3} metalness={0.8} />
      </mesh>
      <group ref={g} position={[0, 0, 0.115]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R * 0.5, R * 0.5, 0.05, 32]} />
          <meshStandardMaterial color="#c4c6c7" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.027]}>
          <boxGeometry args={[R * 1.0, R * 0.16, 0.02]} />
          <meshStandardMaterial color="#2a2b2c" />
        </mesh>
      </group>
    </group>
  )
}

/* Printed legend under the lid: BW WB/NB, PRESET, SQUELCH GD/MN. */
function Markings() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 285 * 3; c.height = 200 * 3
    const g = c.getContext('2d')
    g.scale(3, 3)
    g.fillStyle = '#121315'; g.fillRect(0, 0, 285, 200)
    g.strokeStyle = '#f1f1ee'; g.lineWidth = 2; g.fillStyle = '#f1f1ee'
    g.font = '700 16px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText('BW', 22, 78); g.fillText('WB', 152, 22); g.fillText('NB', 152, 62)
    g.fillText('PRESET', 72, 106); g.fillText('SQUELCH', 226, 100)
    g.fillText('GD', 268, 28); g.fillText('MN', 268, 164)
    const line = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke() }
    line(48, 90, 135, 90, 135, 74); line(135, 32, 135, 52)
    line(35, 138, 35, 108, 47, 108); line(100, 108, 152, 108, 152, 138)
    line(272, 46, 272, 84); line(272, 118, 272, 146)
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <mesh position={[X(198), Y(157), 0.452]}>
      <planeGeometry args={[1.71, 1.2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

/* Frequency card cover: hinged on its right edge, opens toward the viewer. */
function CoverGroup({ open, onToggle, hover, children }) {
  const g = useRef()
  const px = X(291), pz = 0.55
  useFrame((_, dt) => {
    g.current.rotation.y += ((open ? 1.35 : 0) - g.current.rotation.y) * Math.min(1, dt * 6)
  })
  return (
    <group ref={g} position={[px, 0, pz]}>
      <group position={[-px, 0, -pz]} onClick={(e) => { e.stopPropagation(); onToggle() }} {...(hover || pointer)}>
        {children}
      </group>
    </group>
  )
}

/* Channel frequency card: 20 channels, current one highlighted. */
function Card({ presets, chan }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 170 * 4; c.height = 105 * 4
    const g = c.getContext('2d')
    g.scale(4, 4)
    g.fillStyle = '#e8e4cc'; g.fillRect(0, 0, 170, 105)
    g.fillStyle = '#222'; g.font = '700 8px Arial'; g.textBaseline = 'middle'
    g.fillText('CHAN   FREQ (MHz)', 8, 8); g.fillText('CHAN   FREQ (MHz)', 92, 8)
    presets.forEach((f, i) => {
      const col = i < 10 ? 0 : 1, row = i % 10, yy = 20 + row * 8.4
      if (i === chan - 1) { g.fillStyle = '#f0b43c'; g.fillRect(col * 84 + 4, yy - 4, 78, 8.2); g.fillStyle = '#222' }
      g.font = '7.5px monospace'
      g.fillText(`${String(i + 1).padStart(2, '0')}    ${f}`, col * 84 + 8, yy)
    })
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [presets, chan])
  return (
    <mesh position={[X(198), Y(157.5), 0.592]}>
      <planeGeometry args={[1.7, 1.05]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

/* Fluted thumbwheel drum knob: fluted rim + pointer lobe, steps through its digit positions.
   Click or wheel-up = next, Shift-click / right-click / wheel-down = previous. */

function FreqKnob({ x, y, z, r, h = 0.14, rot = 0, index, onStep, hover }) {
  const g = useRef()
  const [turn, setTurn] = useState(0)   // cumulative steps: + = clockwise, - = anticlockwise
  const R = r / 100
  const stepDeg = 360 / SIZES[index]
  const bars = useMemo(() => {
    const w = R * 0.24, gap = R * 0.045
    return [-1, 1].map((k) => {
      const cx = k * (gap + w / 2)
      const len = 2 * Math.sqrt(Math.max(R * R - (Math.abs(cx) + w / 2) ** 2, 0)) * 0.97
      return { cx, w, len }
    })
  }, [R])
  const go = (dir) => { setTurn((t) => t + dir); onStep(dir) }
  useFrame((_, dt) => {
    const t = ((rot - turn * stepDeg * 0.5) * Math.PI) / 180
    g.current.rotation.z += (t - g.current.rotation.z) * Math.min(1, dt * 14)
  })
  return (
    <group ref={g} position={[X(x), Y(y), z]} {...(hover || pointer)}
      onClick={(e) => {
        e.stopPropagation()
        // left half of the knob (or Shift) = anticlockwise, right half = clockwise
        const p = g.current.parent.worldToLocal(e.point.clone())
        go(e.shiftKey || p.x < g.current.position.x ? -1 : 1)
      }}
      onContextMenu={(e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); go(-1) }}
      onWheel={(e) => { e.stopPropagation(); go(e.deltaY < 0 ? 1 : -1) }}>
      {/* round disc */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, h / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R * 1.03, h, 64]} />
        <meshStandardMaterial color={C.knob} roughness={0.5} metalness={0.15} />
      </mesh>
      {/* two parallel raised ribs across the diameter */}
      {bars.map((b, i) => (
        <RoundedBox key={i} args={[b.w, b.len, 0.09]} radius={0.02} smoothness={3}
          position={[b.cx, 0, h + 0.03]} castShadow>
          <meshStandardMaterial color="#9a9d9e" roughness={0.45} metalness={0.2} />
        </RoundedBox>
      ))}
      {/* groove between the ribs */}
      <mesh position={[0, 0, h + 0.004]}>
        <planeGeometry args={[R * 0.045, R * 1.9]} />
        <meshBasicMaterial color="#3a3c3d" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Window({ x, y, w, h, z, text, size = 24 }) {
  const shape = useMemo(() => {
    const W = w / 100, H = h / 100, c = H * 0.28
    const sh = new THREE.Shape()
    sh.moveTo(-W / 2, H / 2)
    sh.lineTo(W / 2, H / 2)
    sh.lineTo(W / 2, -H / 2 + c)
    sh.lineTo(W / 2 - c, -H / 2)
    sh.lineTo(-W / 2 + c, -H / 2)
    sh.lineTo(-W / 2, -H / 2 + c)
    sh.closePath()
    return sh
  }, [w, h])
  return (
    <group position={[X(x), Y(y), z - 0.02]}>
      <mesh castShadow>
        <extrudeGeometry args={[shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.008,
          bevelThickness: 0.008, bevelSegments: 2 }]} />
        <meshStandardMaterial color="#050505" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.13]}>
        <planeGeometry args={[w / 100, h / 100]} />
        <LabelMat text={text} w={w} h={h} size={size} />
      </mesh>
    </group>
  )
}

function LabelMat({ text, w, h, size, color = C.white }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w * 4; c.height = h * 4
    const g = c.getContext('2d')
    g.scale(4, 4)
    g.fillStyle = color
    g.font = `600 ${size}px Arial, Helvetica, sans-serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, w / 2, h / 2 + 1)
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text, w, h, size, color])
  return <meshBasicMaterial map={tex} transparent toneMapped={false} />
}

/* ---------- the radio ---------- */
export default function Radio({ rd }) {
  const chanStr = String(rd.chan).padStart(2, '0')
  const hov = (k) => ({
    onPointerOver: (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; rd.setHint(HINTS[k]) },
    onPointerOut: () => { document.body.style.cursor = 'auto'; rd.setHint(null) },
  })
  const zL = 0.3, zM = 0.4, zU = 0.45, zC = 0.55, zB = 0.5
  return (
    <group position={[0, 0, 0]}>
      {/* lower control panel */}
      <Box x0={78} y0={340} x1={500} y1={462} z1={zL} color={C.lower} r={0.05} />
      {/* frequency band */}
      <Box x0={76} y0={215} x1={502} y1={343} z1={zM} color={C.band} r={0.05} />
      {/* upper-right housing */}
      <Box x0={290} y0={100} x1={492} y1={219} z1={zU} color={C.upper} r={0.05} />
      {/* frequency card compartment (under the cover) */}
      <Box x0={105} y0={97} x1={291} y1={218} z1={zU} color="#0e0f10" r={0.04} />
      <CoverGroup open={rd.coverOpen} onToggle={rd.toggleCover} hover={hov('preset')}>
        <Box x0={105} y0={97} x1={291} y1={218} z0={zC - 0.09} z1={zC} color={C.cover} r={0.04} rough={0.8} />
        <Box x0={113} y0={105} x1={283} y1={210} z0={zC - 0.01} z1={zC + 0.03} color="#242528" r={0.02} />
        <Box x0={105} y0={140} x1={128} y1={170} z0={zC - 0.01} z1={zC + 0.06} color="#141517" r={0.02} />
        <Card presets={rd.presets} chan={rd.chan} />
      </CoverGroup>
      {/* under the lid: BW switch, red PRESET pushbutton, SQUELCH GD/MN adjusters */}
      <Markings />
      <Adjuster x={163} y={121} z={zU} r={16} angle={rd.bw === 'WB' ? 45 : -45}
        onClick={rd.toggleBw} hover={hov('bw')} />
      <ToneButton x={163} y={186} z={zU} s={1.25} hex ring="#a9abac" cap="#c8202a" glow={false}
        onDown={rd.loadPreset} onUp={() => {}} hover={hov('load')} />
      <Adjuster x={246} y={122} z={zU} r={16} angle={rd.sq.GD * 45} onClick={() => rd.stepSq('GD')} hover={hov('sq')} />
      <Adjuster x={246} y={186} z={zU} r={16} angle={rd.sq.MN * 45} onClick={() => rd.stepSq('MN')} hover={hov('sq')} />
      <Box x0={112} y0={178} x1={133} y1={196} z0={zU - 0.01} z1={zU + 0.03} color="#b58a2f" r={0.01} rough={0.4} />
      <Screw x={131} y={187} z={zU + 0.03} r={5} />

      {/* CHAN window */}
      <Label x={335} y={142} z={zU + 0.01} text="CHAN" w={60} h={20} size={14} />
      <Window x={318} y={165} w={30} h={30} z={zU} text={chanStr[0]} />
      <Window x={340} y={165} w={30} h={30} z={zU} text={chanStr[1]} />
      {/* recess + top-right lever knob */}
      <Cyl x={381} y={160} z0={zU - 0.02} z1={zU + 0.03} r={24} color="#0f1011" />
      <ControlKnob x={445} y={158} z={zU} r={30} h={0.24} tip={1.6} angle={55 - (rd.chanTurn - 13) * 18}
        onTurn={rd.turnChan} hover={hov('chanKnob')} />

      {/* frequency drums */}
      <Cyl x={125} y={270} z0={zM - 0.02} z1={zB} r={46} color={C.boss} />
      <Cyl x={205} y={271} z0={zM - 0.02} z1={zB} r={48} color={C.boss} />
      <Cyl x={364} y={268} z0={zM - 0.02} z1={zB} r={52} color={C.boss} />
      <Cyl x={456} y={272} z0={zM - 0.02} z1={zB} r={38} color={C.boss} />
      <Window x={130} y={238} w={30} h={30} z={zB} size={30} text={SHOW[0][rd.digits[0]]} />
      <Window x={207} y={238} w={30} h={30} z={zB} size={30} text={SHOW[1][rd.digits[1]]} />
      <Window x={283} y={240} w={28} h={28} z={zM} size={28} text={SHOW[2][rd.digits[2]]} />
      <Window x={361} y={238} w={44} h={30} z={zB} size={30} text={SHOW[3][rd.digits[3]]} />
      <Window x={447} y={238} w={44} h={30} z={zB} size={30} text={SHOW[4][rd.digits[4]]} />
      <FreqKnob index={0} onStep={(d) => rd.stepDigit(0, d)} hover={hov('freq')} x={124} y={286} z={zB} r={24} />
      <FreqKnob index={1} onStep={(d) => rd.stepDigit(1, d)} hover={hov('freq')} x={206} y={288} z={zB} r={25} />
      <FreqKnob index={2} onStep={(d) => rd.stepDigit(2, d)} hover={hov('freq')} x={283} y={282} z={zM} r={19} />
      <FreqKnob index={3} onStep={(d) => rd.stepDigit(3, d)} hover={hov('freq')} x={366} y={288} z={zB} r={26} />
      <FreqKnob index={4} onStep={(d) => rd.stepDigit(4, d)} hover={hov('freq')} x={452} y={288} z={zB} r={24} />

      {/* lower panel labels */}
      {[['U', 383], ['H', 399], ['F', 415]].map(([t, py]) => (
        <Label key={t} x={115} y={py} z={zL + 0.01} text={t} w={20} h={18} size={15} color={C.uhf} />
      ))}
      <Label x={133} y={362} z={zL + 0.01} text="OFF" />
      <Label x={160} y={346} z={zL + 0.01} text="MAIN" />
      <Label x={206} y={362} z={zL + 0.01} text="BOTH" />
      <Label x={215} y={378} z={zL + 0.01} text="ADF" />
      <Label x={281} y={345} z={zL + 0.01} text="VOL" />
      <Label x={354} y={363} z={zL + 0.01} text="MANUAL" />
      <Label x={398} y={347} z={zL + 0.01} text="PRESET" />
      <Label x={447} y={363} z={zL + 0.01} text="GUARD" />
      <Label x={238} y={442} z={zL + 0.01} text="TONE" />
      <Label x={311} y={431} z={zL + 0.01} text="OFF" />
      <Label x={359} y={431} z={zL + 0.01} text="ON" />
      <Label x={331} y={448} z={zL + 0.01} text="SQUELCH" w={90} />

      {/* lower controls */}
      <ControlKnob x={160} y={403} z={zL} r={28} h={0.24} tip={1.75} angle={[33, 0, -48, -65][rd.power]}
        onTurn={rd.stepPower} hover={hov('uhf')} />
      <VolKnob x={280} y={382} z={zL} r={25} vol={rd.vol} onTurn={rd.stepVol} hover={hov('vol')} />
      <ToneButton x={237} y={415} z={zL} onDown={() => rd.pressTone(true)} onUp={() => rd.pressTone(false)}
        hover={hov('tone')} />
      <Toggle x={333} y={414} z={zL} on={rd.squelch} onToggle={rd.toggleSquelch} hover={hov('squelch')} />
      <ControlKnob x={405} y={403} z={zL} r={31} h={0.25} tip={1.5} angle={[52, 7, -46][rd.mode]}
        onTurn={rd.stepMode} hover={hov('mode')} />

      {/* screws */}
      {[[88, 138], [88, 196], [480, 138], [480, 196]].map(([a, b]) => (
        <Screw key={a + '-' + b} x={a} y={b} z={zU} r={11} />
      ))}
      <Screw x={455} y={118} z={zU} r={6} />
      <Screw x={86} y={328} z={zM} r={7} />
      <Screw x={492} y={326} z={zM} r={7} />
      {[[88, 362], [88, 418], [488, 362], [488, 418]].map(([a, b]) => (
        <Screw key={a + '+' + b} x={a} y={b} z={zL} r={11} rot={0.3} />
      ))}
      <Screw x={123} y={441} z={zL} r={9} />
      <Screw x={453} y={440} z={zL} r={9} />
    </group>
  )
}
