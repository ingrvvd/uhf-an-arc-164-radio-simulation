import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import Radio from './Radio.jsx'
import Overlay from './Overlay.jsx'
import { useRadioState } from './radioState.js'

export default function App() {
  const rd = useRadioState()
  return (
    <>
    <Canvas shadows camera={{ position: [1.4, 0.9, 7], fov: 32 }} gl={{ antialias: true }}>
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#555566', 0.6]} />
      <directionalLight position={[3, 4, 6]} intensity={2.2} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <directionalLight position={[-5, -2, 4]} intensity={0.8} />
      <Radio rd={rd} />
      <ContactShadows position={[0, -2.0, 0]} opacity={0.25} scale={10} blur={2.6} far={3} />
      <OrbitControls enableDamping makeDefault minDistance={3} maxDistance={12}
        maxPolarAngle={Math.PI * 0.8} minPolarAngle={Math.PI * 0.2}
        minAzimuthAngle={-Math.PI / 2.2} maxAzimuthAngle={Math.PI / 2.2} />
    </Canvas>
    <Overlay rd={rd} />
    </>
  )
}
