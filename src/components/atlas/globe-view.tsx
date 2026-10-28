"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface GlobeMarker {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Projects image coordinates onto a sphere (equirectangular). */
function toSphere(x: number, y: number, w: number, h: number, r: number): [number, number, number] {
  const lon = (x / w) * Math.PI * 2 - Math.PI;
  const lat = Math.PI / 2 - (y / h) * Math.PI;
  return [r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon)];
}

function Globe({ image, width, height, markers, onHover, rotation }: { image: string; width: number; height: number; markers: GlobeMarker[]; onHover: (m: GlobeMarker | null) => void; rotation: React.RefObject<{ x: number; y: number; dragging: boolean }> }) {
  const texture = useLoader(THREE.TextureLoader, image);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- three.js textures are configured by mutation
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  const group = useRef<THREE.Group>(null);
  // The render loop advances shared, mutable rotation state by design (no React re-render per frame).
  /* eslint-disable react-hooks/immutability */
  useFrame((_, dt) => {
    const rot = rotation.current;
    if (!group.current || !rot) return;
    if (!rot.dragging) rot.y += dt * 0.06;
    group.current.rotation.y = rot.y;
    group.current.rotation.x = rot.x;
  });
  /* eslint-enable react-hooks/immutability */
  const points = useMemo(() => markers.map((m) => ({ m, p: toSphere(m.x, m.y, width, height, 1.01) })), [markers, width, height]);
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
      {points.map(({ m, p }) => (
        <mesh key={m.id} position={p} onPointerOver={() => onHover(m)} onPointerOut={() => onHover(null)}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshBasicMaterial color="#D6BD8D" />
        </mesh>
      ))}
    </group>
  );
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function GlobeView(props: { image: string; width: number; height: number; markers: GlobeMarker[] }) {
  const [hover, setHover] = useState<GlobeMarker | null>(null);
  const [supported] = useState(() => (typeof document === "undefined" ? true : webglAvailable()));
  const rotation = useRef({ x: 0.25, y: 0, dragging: false });
  const last = useRef<{ x: number; y: number } | null>(null);
  if (!supported) {
    return <p className="p-8 text-center text-sm text-text-2">WebGL is not available in this browser, so the experimental globe cannot be shown. The 2D Atlas works everywhere.</p>;
  }
  return (
    <div
      className="relative size-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => {
        rotation.current.dragging = true;
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        rotation.current.y += (e.clientX - last.current.x) * 0.006;
        rotation.current.x = Math.max(-1.2, Math.min(1.2, rotation.current.x + (e.clientY - last.current.y) * 0.006));
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        rotation.current.dragging = false;
        last.current = null;
      }}
    >
      <Canvas camera={{ position: [0, 0, 2.8], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 2, 4]} intensity={1.4} color="#f4e6c8" />
        <Suspense fallback={null}>
          <Globe {...props} onHover={setHover} rotation={rotation} />
        </Suspense>
      </Canvas>
      {hover ? <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-gold/40 bg-surface px-3 py-1 text-sm text-gold">{hover.name}</div> : null}
    </div>
  );
}
