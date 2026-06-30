"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  PointerLockControls,
  MeshReflectorMaterial,
  Environment,
  Lightformer,
  Text,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Artist, Artwork } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { artImage } from "@/lib/img";

interface Props {
  artist: Artist;
  works: Artwork[];
  images: Record<string, ImageMeta>;
  onInspect: (w: Artwork) => void;
  onFocus: (w: Artwork | null) => void;
  onLockChange: (locked: boolean) => void;
}

const HALF_W = 4;
const EYE = 1.65;
const SPACING = 5;

function usePlacements(works: Artwork[]) {
  return useMemo(() => {
    return works.map((w, i) => {
      const left = i % 2 === 0;
      const z = -SPACING * (Math.floor(i / 2) + 1);
      const x = left ? -HALF_W + 0.06 : HALF_W - 0.06;
      const rotY = left ? Math.PI / 2 : -Math.PI / 2;
      return { work: w, x, z, rotY, left };
    });
  }, [works]);
}

function Frame({
  work,
  url,
  x,
  z,
  rotY,
}: {
  work: Artwork;
  url: string;
  x: number;
  z: number;
  rotY: number;
}) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(1.3);

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (t) => {
        if (!alive) return;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        setTex(t);
        const img = t.image as { width: number; height: number };
        if (img?.width && img?.height) setAspect(img.width / img.height);
      },
      undefined,
      () => {
        /* leave placeholder */
      }
    );
    return () => {
      alive = false;
    };
  }, [url]);

  const H = 2.1;
  const W = Math.min(3.4, H * aspect);
  const target = useMemo(() => new THREE.Object3D(), []);

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* spotlight aimed at the canvas */}
      <primitive object={target} position={[0, EYE, 0.4]} />
      <spotLight
        position={[0, 2.0, 1.6]}
        angle={0.55}
        penumbra={0.7}
        intensity={22}
        distance={9}
        color={"#fff3df"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        target={target}
      />
      {/* outer gilt frame */}
      <mesh position={[0, EYE, 0.02]} castShadow>
        <boxGeometry args={[W + 0.34, H + 0.34, 0.12]} />
        <meshStandardMaterial color={"#b9912f"} metalness={0.85} roughness={0.35} />
      </mesh>
      {/* mat board */}
      <mesh position={[0, EYE, 0.085]}>
        <boxGeometry args={[W + 0.14, H + 0.14, 0.04]} />
        <meshStandardMaterial color={"#0e0f12"} roughness={0.9} />
      </mesh>
      {/* the artwork itself (userData lets the raycaster identify it) */}
      <mesh position={[0, EYE, 0.12]} userData={{ workId: work.id }}>
        <planeGeometry args={[W, H]} />
        {tex ? (
          <meshStandardMaterial map={tex} roughness={0.55} metalness={0.0} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={"#1b1d22"} roughness={1} />
        )}
      </mesh>
      {/* label placard */}
      <Text
        position={[0, EYE - H / 2 - 0.34, 0.13]}
        fontSize={0.12}
        maxWidth={W + 0.2}
        anchorX="center"
        anchorY="middle"
        color="#e7cf9b"
        outlineWidth={0}
      >
        {`${work.title}\n${work.date}`}
      </Text>
    </group>
  );
}

function Hall({ length }: { length: number }) {
  const zMid = -length / 2;
  return (
    <group>
      {/* reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zMid]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, length + 8]} />
        <MeshReflectorMaterial
          resolution={1024}
          mirror={0.55}
          mixBlur={8}
          mixStrength={1.2}
          blur={[300, 80]}
          roughness={0.85}
          depthScale={1.0}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#0a0b0e"
          metalness={0.55}
        />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, zMid]}>
        <planeGeometry args={[HALF_W * 2, length + 8]} />
        <meshStandardMaterial color="#15171c" roughness={1} />
      </mesh>
      {/* walls */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * HALF_W, 2.5, zMid]}
          rotation={[0, (-s * Math.PI) / 2, 0]}
          receiveShadow
        >
          <planeGeometry args={[length + 8, 5]} />
          <meshStandardMaterial color="#1c1f26" roughness={0.95} />
        </mesh>
      ))}
      {/* end walls */}
      <mesh position={[0, 2.5, 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, 5]} />
        <meshStandardMaterial color="#1c1f26" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.5, -length - 3]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, 5]} />
        <meshStandardMaterial color="#1c1f26" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Player({
  bounds,
  onFocus,
  onInspect,
  onLockChange,
}: {
  bounds: { zMin: number };
  onFocus: (id: string | null) => void;
  onInspect: (id: string) => void;
  onLockChange: (b: boolean) => void;
}) {
  const { camera, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const focused = useRef<string | null>(null);

  useEffect(() => {
    camera.position.set(0, EYE, 1);
    const dn = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    const click = () => {
      if (focused.current) onInspect(focused.current);
    };
    window.addEventListener("mousedown", click);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousedown", click);
    };
  }, [camera, onInspect]);

  const dir = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, delta) => {
    const speed = 3.4 * Math.min(delta, 0.05);
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    side.crossVectors(dir, up).normalize();
    const k = keys.current;
    if (k["KeyW"] || k["ArrowUp"]) camera.position.addScaledVector(dir, speed);
    if (k["KeyS"] || k["ArrowDown"]) camera.position.addScaledVector(dir, -speed);
    if (k["KeyD"] || k["ArrowRight"]) camera.position.addScaledVector(side, speed);
    if (k["KeyA"] || k["ArrowLeft"]) camera.position.addScaledVector(side, -speed);

    // collision: clamp inside the hall
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -HALF_W + 0.5, HALF_W - 0.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.zMin + 0.6, 1.4);
    camera.position.y = EYE;

    // center raycast to find the focused artwork
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(scene.children, true);
    let id: string | null = null;
    for (const h of hits) {
      const wid = (h.object.userData as any)?.workId;
      if (wid && h.distance < 6) {
        id = wid;
        break;
      }
      if (h.distance < 6) break;
    }
    if (id !== focused.current) {
      focused.current = id;
      onFocus(id);
    }
  });

  return (
    <PointerLockControls onLock={() => onLockChange(true)} onUnlock={() => onLockChange(false)} />
  );
}

export default function Gallery3D({
  artist,
  works,
  images,
  onInspect,
  onFocus,
  onLockChange,
}: Props) {
  const placements = usePlacements(works);
  const length = (Math.floor((works.length - 1) / 2) + 1) * SPACING + 3;

  const byId = useMemo(() => {
    const m: Record<string, Artwork> = {};
    works.forEach((w) => (m[w.id] = w));
    return m;
  }, [works]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ fov: 70, near: 0.05, far: 100, position: [0, EYE, 1] }}
    >
      <color attach="background" args={["#070809"]} />
      <fog attach="fog" args={["#070809", 10, length + 14]} />

      {/* ambient + key fill */}
      <ambientLight intensity={0.18} />
      <hemisphereLight args={["#cdd6e0", "#0a0a0c", 0.25]} />
      <pointLight position={[0, 4.6, -length / 2]} intensity={12} distance={length + 12} color="#fff0d8" />

      {/* procedural HDR-style environment for PBR reflections (no external asset) */}
      <Environment resolution={256}>
        <Lightformer intensity={1.2} position={[0, 5, 0]} scale={[10, 10, 1]} color="#fff4e2" />
        <Lightformer intensity={0.6} position={[0, 2, 6]} scale={[8, 4, 1]} color="#9fb4c7" />
        <Lightformer intensity={0.6} position={[0, 2, -length - 4]} scale={[8, 4, 1]} color="#9fb4c7" />
      </Environment>

      <Suspense fallback={null}>
        <Hall length={length} />
        {placements.map((p) => (
          <Frame
            key={p.work.id}
            work={p.work}
            url={artImage(p.work, images[p.work.id], 1200)}
            x={p.x}
            z={p.z}
            rotY={p.rotY}
          />
        ))}
      </Suspense>

      <Player
        bounds={{ zMin: -length - 1 }}
        onFocus={(id) => onFocus(id ? byId[id] ?? null : null)}
        onInspect={(id) => byId[id] && onInspect(byId[id])}
        onLockChange={onLockChange}
      />

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.5} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
