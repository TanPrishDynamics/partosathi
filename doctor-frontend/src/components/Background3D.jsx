import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 3500;

/* ── Drifting particle field ──────────────────────────────────────────────── */
function ParticleField() {
  const meshRef = useRef();
  const velocities = useRef([]);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors    = new Float32Array(PARTICLE_COUNT * 3);
    velocities.current = [];

    // Colour palette: cyan, electric blue, teal
    const palette = [
      new THREE.Color('#00f5d4'),
      new THREE.Color('#005eff'),
      new THREE.Color('#00b4d8'),
      new THREE.Color('#0077b6'),
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3]     = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      velocities.current.push(
        (Math.random() - 0.5) * 0.008,
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.004,
      );
    }
    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const pos = meshRef.current.geometry.attributes.position.array;
    const vel = velocities.current;
    const t   = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      // Drift + subtle sinusoidal wave (DNA-like)
      pos[ix]     += vel[ix]     + Math.sin(t * 0.3 + i * 0.1) * 0.0004;
      pos[ix + 1] += vel[ix + 1] + Math.cos(t * 0.2 + i * 0.15) * 0.0003;
      pos[ix + 2] += vel[ix + 2];

      // Wrap-around bounds
      if (pos[ix]     >  20) pos[ix]     = -20;
      if (pos[ix]     < -20) pos[ix]     =  20;
      if (pos[ix + 1] >  13) pos[ix + 1] = -13;
      if (pos[ix + 1] < -13) pos[ix + 1] =  13;
      if (pos[ix + 2] >   9) pos[ix + 2] =  -9;
      if (pos[ix + 2] <  -9) pos[ix + 2] =   9;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    // Slow global rotation
    meshRef.current.rotation.y = t * 0.012;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ── Wireframe torus (far background) ────────────────────────────────────── */
function BackgroundTorus() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * 0.025;
    ref.current.rotation.y = state.clock.elapsedTime * 0.018;
  });
  return (
    <mesh ref={ref} position={[2, 0, -10]} scale={1}>
      <torusGeometry args={[7, 2.5, 12, 40]} />
      <meshBasicMaterial color="#00f5d4" wireframe transparent opacity={0.035} />
    </mesh>
  );
}

/* ── Second torus for depth ───────────────────────────────────────────────── */
function BackgroundTorus2() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = -state.clock.elapsedTime * 0.018;
    ref.current.rotation.z =  state.clock.elapsedTime * 0.01;
  });
  return (
    <mesh ref={ref} position={[-6, -2, -14]}>
      <torusGeometry args={[5, 1.5, 10, 32]} />
      <meshBasicMaterial color="#005eff" wireframe transparent opacity={0.025} />
    </mesh>
  );
}

/* ── Parallax camera follows mouse ───────────────────────────────────────── */
function ParallaxCamera() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(() => {
    current.current.x += (mouse.current.x - current.current.x) * 0.04;
    current.current.y += (mouse.current.y - current.current.y) * 0.03;
    camera.position.x = current.current.x * 1.8;
    camera.position.y = -current.current.y * 1.2;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ── Scene lighting ──────────────────────────────────────────────────────── */
function SceneLights() {
  return (
    <>
      <ambientLight color="#0a2a4a" intensity={0.4} />
      <pointLight color="#00f5d4" intensity={0.8} position={[5, 5, 5]} />
      <pointLight color="#005eff" intensity={0.4} position={[-10, 0, -5]} />
    </>
  );
}

/* ── Public component ────────────────────────────────────────────────────── */
export default function Background3D() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      background: 'linear-gradient(135deg, #020B18 0%, #071428 60%, #060420 100%)',
    }}>
      <Canvas
        camera={{ position: [0, 0, 12], fov: 70 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
      >
        <SceneLights />
        <ParticleField />
        <BackgroundTorus />
        <BackgroundTorus2 />
        <ParallaxCamera />
      </Canvas>

      {/* Volumetric god-ray — top-left corner (CSS) */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: '55vw',
        height: '80vh',
        background: 'radial-gradient(ellipse at top left, rgba(0,245,212,0.055) 0%, rgba(0,94,255,0.03) 35%, transparent 70%)',
        pointerEvents: 'none',
        transform: 'rotate(-15deg)',
      }} />
      {/* Bottom-right ambient */}
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-5%',
        width: '40vw',
        height: '50vh',
        background: 'radial-gradient(ellipse at bottom right, rgba(0,94,255,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
