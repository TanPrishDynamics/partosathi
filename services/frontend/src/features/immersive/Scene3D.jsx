/**
 * Scene3D.jsx — Full-screen ambient 3D background canvas
 *
 * Renders:
 *  • Floating particle field (instanced mesh, 300 particles)
 *  • Slow-rotating DNA helix made of paired spheres
 *  • Pulsating AI orb in bottom-right corner area
 *  • Gradient environment lighting
 *
 * Kept intentionally LOW-POLY for 50+ FPS on mid-range hardware.
 * All animation via useFrame — no GSAP dependency.
 */
import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ── Instanced particle field ──────────────────────────────────────────────────
function ParticleField({ count = 280 }) {
  const meshRef = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  // Pre-compute stable random positions
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      pos:   new THREE.Vector3((Math.random() - 0.5) * 32, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 14),
      speed: 0.12 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
      scale: 0.04 + Math.random() * 0.08,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    particles.forEach((p, i) => {
      dummy.position.set(
        p.pos.x,
        p.pos.y + Math.sin(t * p.speed + p.phase) * 0.4,
        p.pos.z,
      );
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshStandardMaterial
        color="#4FD1C5"
        emissive="#4FD1C5"
        emissiveIntensity={0.7}
        transparent
        opacity={0.55}
      />
    </instancedMesh>
  );
}

// ── DNA helix (paired spheres along a helical path) ───────────────────────────
function DNAHelix({ turns = 5, pairs = 28 }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (groupRef.current)
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.08;
  });

  const helixPoints = useMemo(() => {
    return Array.from({ length: pairs }, (_, i) => {
      const t  = (i / pairs) * turns * Math.PI * 2;
      const y  = (i / pairs) * 10 - 5;
      const r  = 1.1;
      return {
        a: new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r),
        b: new THREE.Vector3(Math.cos(t + Math.PI) * r, y, Math.sin(t + Math.PI) * r),
      };
    });
  }, [turns, pairs]);

  return (
    <group ref={groupRef} position={[-11, 0, -5]}>
      {helixPoints.map(({ a, b }, i) => (
        <React.Fragment key={i}>
          <Sphere args={[0.10, 6, 6]} position={a}>
            <meshStandardMaterial color="#B794F4" emissive="#B794F4" emissiveIntensity={0.9} />
          </Sphere>
          <Sphere args={[0.10, 6, 6]} position={b}>
            <meshStandardMaterial color="#F472B6" emissive="#F472B6" emissiveIntensity={0.9} />
          </Sphere>
        </React.Fragment>
      ))}
    </group>
  );
}

// ── Pulsating AI orb ──────────────────────────────────────────────────────────
function AIOrb({ active = false }) {
  const orbRef = useRef();

  useFrame(({ clock }) => {
    if (!orbRef.current) return;
    const t = clock.getElapsedTime();
    orbRef.current.position.y = Math.sin(t * 0.6) * 0.18;
    orbRef.current.material.distort = active
      ? 0.55 + Math.sin(t * 3) * 0.1
      : 0.25 + Math.sin(t * 1.2) * 0.05;
    orbRef.current.material.speed = active ? 3.5 : 1.2;
  });

  return (
    <mesh ref={orbRef} position={[9, -3, 0]}>
      <sphereGeometry args={[1.1, 32, 32]} />
      <MeshDistortMaterial
        color="#6B46C1"
        emissive="#4FD1C5"
        emissiveIntensity={active ? 1.4 : 0.6}
        distort={0.3}
        speed={1.5}
        transparent
        opacity={0.82}
      />
    </mesh>
  );
}

// ── Camera gentle drift ───────────────────────────────────────────────────────
function CameraDrift() {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.07) * 0.6;
    camera.position.y = Math.cos(t * 0.05) * 0.4;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── Scene root ────────────────────────────────────────────────────────────────
export default function Scene3D({ aiActive = false }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 14], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      dpr={[1, 1.5]}   // cap pixel ratio for performance
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]}  color="#4FD1C5" intensity={2.5} />
        <pointLight position={[-5, -5, 3]} color="#B794F4" intensity={1.8} />
        <pointLight position={[0, 8, -4]}  color="#F472B6" intensity={1.2} />

        <Environment preset="night" />

        <ParticleField count={260} />
        <DNAHelix />
        <AIOrb active={aiActive} />
        <CameraDrift />
      </Suspense>
    </Canvas>
  );
}
