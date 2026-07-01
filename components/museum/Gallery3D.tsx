"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, MeshReflectorMaterial, Environment, Lightformer, Text, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Artist, Artwork, Period } from "@/lib/data/types";
import type { ImageMeta } from "@/lib/img";
import { artImage } from "@/lib/img";

interface Props {
  artist: Artist;
  period?: Period | null;
  works: Artwork[];
  images: Record<string, ImageMeta>;
  tour: boolean;
  onInspect: (w: Artwork) => void;
  onFocus: (w: Artwork | null) => void;
  onLockChange: (locked: boolean) => void;
  onTourEnd: () => void;
}

const HALF_W = 4.2;
const EYE = 1.65;
const SPACING = 5;

type Arch = "pillars" | "carpet" | "none";
interface Style {
  wall: string; floor: string; floorMetal: number; ceiling: string;
  ambient: number; hemiSky: string; hemiGround: string; hemiInt: number;
  key: string; skylight: string; arch: Arch; accent: string; mote: string;
}
const TEMPLE = new Set(["i-indus", "i-maurya", "i-shunga", "i-gupta", "i-ajanta", "i-chalukya", "i-pallava", "i-rashtrakuta", "i-chola", "i-chandela", "i-ganga", "i-vijayanagara", "i-mughal", "i-rajput"]);
const SALON = new Set(["w-renaissance", "w-baroque", "w-dutch", "w-vienna"]);
const MODERN = new Set(["w-edo", "w-impressionism", "w-postimpressionism", "w-modern"]);

function styleFor(period?: Period | null): Style {
  const id = period?.id ?? "";
  if (TEMPLE.has(id)) return { wall: "#8a6f4e", floor: "#241b12", floorMetal: 0.5, ceiling: "#2a2018", ambient: 0.34, hemiSky: "#f3e6cd", hemiGround: "#2a2018", hemiInt: 0.5, key: "#ffdca6", skylight: "#ffe6bd", arch: "pillars", accent: "#caa46f", mote: "#ffe6bd" };
  if (SALON.has(id)) return { wall: "#cdbfa0", floor: "#4a3324", floorMetal: 0.35, ceiling: "#e9e0cd", ambient: 0.38, hemiSky: "#fff3df", hemiGround: "#241a12", hemiInt: 0.55, key: "#fff0d8", skylight: "#fff4e0", arch: "carpet", accent: "#b08d4f", mote: "#fff0d8" };
  if (MODERN.has(id)) return { wall: "#e7e7ea", floor: "#c9c9cf", floorMetal: 0.6, ceiling: "#f4f4f6", ambient: 0.55, hemiSky: "#ffffff", hemiGround: "#9a9aa2", hemiInt: 0.65, key: "#ffffff", skylight: "#ffffff", arch: "none", accent: "#8a8a93", mote: "#ffffff" };
  return { wall: "#bcae93", floor: "#2c241c", floorMetal: 0.45, ceiling: "#d8cdb6", ambient: 0.4, hemiSky: "#fff1da", hemiGround: "#241a12", hemiInt: 0.55, key: "#ffeccb", skylight: "#fff2dc", arch: "none", accent: "#b08d4f", mote: "#ffeccb" };
}

function usePlacements(works: Artwork[]) {
  return useMemo(() => works.map((w, i) => {
    const left = i % 2 === 0;
    const z = -SPACING * (Math.floor(i / 2) + 1);
    const x = left ? -HALF_W + 0.06 : HALF_W - 0.06;
    return { work: w, x, z, rotY: left ? Math.PI / 2 : -Math.PI / 2, left };
  }), [works]);
}

function Frame({ work, url, x, z, rotY, accent }: { work: Artwork; url: string; x: number; z: number; rotY: number; accent: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(1.3);
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(url, (t) => { if (!alive) return; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; setTex(t); const img = t.image as { width: number; height: number }; if (img?.width && img?.height) setAspect(img.width / img.height); }, undefined, () => {});
    return () => { alive = false; };
  }, [url]);
  const H = 2.0; const W = Math.min(3.2, H * aspect);
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <primitive object={target} position={[0, EYE, 0.4]} />
      <spotLight position={[0, 2.1, 1.7]} angle={0.6} penumbra={0.75} intensity={26} distance={9} color={"#fff4e2"} castShadow shadow-mapSize={[1024, 1024]} target={target} />
      <mesh position={[0, EYE, 0.02]} castShadow>
        <boxGeometry args={[W + 0.3, H + 0.3, 0.12]} />
        <meshStandardMaterial color={accent} metalness={0.8} roughness={0.34} />
      </mesh>
      <mesh position={[0, EYE, 0.085]}>
        <boxGeometry args={[W + 0.12, H + 0.12, 0.04]} />
        <meshStandardMaterial color={"#15110b"} roughness={0.9} />
      </mesh>
      <mesh position={[0, EYE, 0.12]} userData={{ workId: work.id }}>
        <planeGeometry args={[W, H]} />
        {tex ? <meshStandardMaterial map={tex} roughness={0.5} toneMapped={false} /> : <meshStandardMaterial color={"#1b1d22"} roughness={1} />}
      </mesh>
      <Text position={[0, EYE - H / 2 - 0.3, 0.13]} fontSize={0.11} maxWidth={W + 0.2} anchorX="center" anchorY="middle" color="#efe6d2" outlineWidth={0}>
        {`${work.title}\n${work.date}`}
      </Text>
    </group>
  );
}

function Hall({ length, style, title }: { length: number; style: Style; title: string }) {
  const zMid = -length / 2;
  const slotZs = useMemo(() => { const out: number[] = []; for (let k = 0; k <= Math.ceil(length / SPACING); k++) out.push(-SPACING * k + SPACING / 2); return out; }, [length]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zMid]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, length + 8]} />
        <MeshReflectorMaterial resolution={1024} mirror={0.4} mixBlur={10} mixStrength={1.0} blur={[300, 90]} roughness={0.9} depthScale={1.0} minDepthThreshold={0.4} maxDepthThreshold={1.2} color={style.floor} metalness={style.floorMetal} />
      </mesh>
      {style.arch === "carpet" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, zMid]}>
          <planeGeometry args={[1.7, length + 6]} /><meshStandardMaterial color={"#5a1f22"} roughness={0.95} />
        </mesh>
      )}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, zMid]}>
        <planeGeometry args={[HALF_W * 2, length + 8]} /><meshStandardMaterial color={style.ceiling} roughness={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.96, zMid]}>
        <planeGeometry args={[1.5, length + 6]} /><meshStandardMaterial color={style.skylight} emissive={style.skylight} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * HALF_W, 2.5, zMid]} rotation={[0, (-s * Math.PI) / 2, 0]} receiveShadow>
          <planeGeometry args={[length + 8, 5]} /><meshStandardMaterial color={style.wall} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, 5]} /><meshStandardMaterial color={style.wall} roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.5, -length - 3]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, 5]} /><meshStandardMaterial color={style.wall} roughness={0.95} />
      </mesh>
      <Text position={[0, 3.0, -length - 2.88]} fontSize={0.46} letterSpacing={0.18} anchorX="center" anchorY="middle" color={style.accent} outlineWidth={0}>
        {title.toUpperCase()}
      </Text>
      {style.arch === "pillars" && slotZs.map((pz, i) => [-1, 1].map((s) => (
        <mesh key={`${i}-${s}`} position={[s * (HALF_W - 0.35), 2.5, pz]} castShadow>
          <cylinderGeometry args={[0.26, 0.3, 5, 16]} /><meshStandardMaterial color={style.wall} roughness={0.85} metalness={0.05} />
        </mesh>
      )))}
      {/* benches down the centre */}
      {slotZs.filter((_, i) => i > 0).map((bz, i) => (
        <group key={`b-${i}`} position={[0, 0, bz]}>
          <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[1.5, 0.12, 0.5]} /><meshStandardMaterial color={"#3a2c1e"} roughness={0.6} metalness={0.1} /></mesh>
          <mesh position={[0, 0.22, 0]}><boxGeometry args={[1.3, 0.32, 0.34]} /><meshStandardMaterial color={"#241a11"} roughness={0.8} /></mesh>
        </group>
      ))}
      {slotZs.map((pz, i) => <pointLight key={`pl-${i}`} position={[0, 4.6, pz]} intensity={11} distance={12} color={style.key} />)}
    </group>
  );
}

function Player({ active, bounds, onFocus, onInspect, onLockChange }: { active: boolean; bounds: { zMin: number }; onFocus: (id: string | null) => void; onInspect: (id: string) => void; onLockChange: (b: boolean) => void; }) {
  const { camera, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const focused = useRef<string | null>(null);
  useEffect(() => {
    const dn = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    const click = () => { if (active && focused.current) onInspect(focused.current); };
    window.addEventListener("mousedown", click);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); window.removeEventListener("mousedown", click); };
  }, [onInspect, active]);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame((state, delta) => {
    if (!active) return;
    const speed = 3.4 * Math.min(delta, 0.05);
    camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    side.crossVectors(dir, up).normalize();
    const k = keys.current; let moving = false;
    if (k["KeyW"] || k["ArrowUp"]) { camera.position.addScaledVector(dir, speed); moving = true; }
    if (k["KeyS"] || k["ArrowDown"]) { camera.position.addScaledVector(dir, -speed); moving = true; }
    if (k["KeyD"] || k["ArrowRight"]) { camera.position.addScaledVector(side, speed); moving = true; }
    if (k["KeyA"] || k["ArrowLeft"]) { camera.position.addScaledVector(side, -speed); moving = true; }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -HALF_W + 0.6, HALF_W - 0.6);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.zMin + 0.6, 1.4);
    camera.position.y = EYE + (moving ? Math.sin(state.clock.elapsedTime * 9) * 0.025 : 0);
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(scene.children, true);
    let id: string | null = null;
    for (const h of hits) { const wid = (h.object.userData as any)?.workId; if (wid && h.distance < 6) { id = wid; break; } if (h.distance < 6) break; }
    if (id !== focused.current) { focused.current = id; onFocus(id); }
  });
  return active ? <PointerLockControls onLock={() => onLockChange(true)} onUnlock={() => onLockChange(false)} /> : null;
}

interface Stop { pos: [number, number, number]; look: [number, number, number]; id?: string }
function TourCam({ stops, onFocus, onEnd }: { stops: Stop[]; onFocus: (id: string | null) => void; onEnd: () => void }) {
  const { camera } = useThree();
  const i = useRef(0); const phase = useRef<"travel" | "dwell">("travel");
  const from = useRef(new THREE.Vector3()); const t0 = useRef(0); const inited = useRef(false);
  const lookCur = useRef(new THREE.Vector3()); const ended = useRef(false);
  useFrame((state, delta) => {
    const stop = stops[i.current]; if (!stop || ended.current) return;
    const target = new THREE.Vector3(stop.pos[0], stop.pos[1], stop.pos[2]);
    const lookTarget = new THREE.Vector3(stop.look[0], stop.look[1], stop.look[2]);
    if (!inited.current) { from.current.copy(camera.position); t0.current = state.clock.elapsedTime; inited.current = true; if (lookCur.current.lengthSq() === 0) lookCur.current.copy(lookTarget); }
    if (phase.current === "travel") {
      const dur = Math.max(1.4, from.current.distanceTo(target) / 2.6);
      const raw = Math.min(1, (state.clock.elapsedTime - t0.current) / dur);
      const e = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      camera.position.lerpVectors(from.current, target, e);
      lookCur.current.lerp(lookTarget, Math.min(1, delta * 3));
      camera.lookAt(lookCur.current);
      if (raw >= 1) { phase.current = "dwell"; t0.current = state.clock.elapsedTime; onFocus(stop.id ?? null); }
    } else {
      lookCur.current.lerp(lookTarget, Math.min(1, delta * 3));
      camera.lookAt(lookCur.current);
      if (state.clock.elapsedTime - t0.current > (stop.id ? 3.4 : 1.2)) {
        i.current++; inited.current = false; onFocus(null); phase.current = "travel";
        if (i.current >= stops.length) { ended.current = true; onEnd(); }
      }
    }
  });
  return null;
}

export default function Gallery3D({ artist, period, works, images, tour, onInspect, onFocus, onLockChange, onTourEnd }: Props) {
  const placements = usePlacements(works);
  const length = (Math.floor((works.length - 1) / 2) + 1) * SPACING + 3;
  const style = useMemo(() => styleFor(period), [period]);
  const byId = useMemo(() => { const m: Record<string, Artwork> = {}; works.forEach((w) => (m[w.id] = w)); return m; }, [works]);
  const bgCol = MODERN.has(period?.id ?? "") ? "#dfe0e4" : "#0c0a08";
  const zMid = -length / 2;
  const tourStops = useMemo<Stop[]>(() => {
    const s: Stop[] = [{ pos: [0, EYE, 0.5], look: [0, EYE, -3] }];
    placements.forEach((p) => s.push({ pos: [p.left ? p.x + 2.5 : p.x - 2.5, EYE, p.z], look: [p.x, EYE, p.z], id: p.work.id }));
    s.push({ pos: [0, EYE, 0.8], look: [0, EYE, -3] });
    return s;
  }, [placements]);

  return (
    <Canvas shadows dpr={[1, 1.8]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }} camera={{ fov: 70, near: 0.05, far: 100, position: [0, EYE, 1] }}>
      <color attach="background" args={[bgCol]} />
      <fog attach="fog" args={[bgCol, 26, length + 60]} />
      <ambientLight intensity={style.ambient} />
      <hemisphereLight args={[style.hemiSky, style.hemiGround, style.hemiInt]} />
      <directionalLight position={[2, 6, 2]} intensity={0.35} color={style.key} />
      <Environment resolution={256}>
        <Lightformer intensity={1.4} position={[0, 5, 0]} scale={[12, 12, 1]} color={style.skylight} />
        <Lightformer intensity={0.7} position={[0, 2, 6]} scale={[10, 5, 1]} color={style.hemiSky} />
        <Lightformer intensity={0.7} position={[0, 2, -length - 4]} scale={[10, 5, 1]} color={style.hemiSky} />
      </Environment>
      <Suspense fallback={null}>
        <Hall length={length} style={style} title={artist.name} />
        {placements.map((p) => (
          <Frame key={p.work.id} work={p.work} url={artImage(p.work, images[p.work.id], 900)} x={p.x} z={p.z} rotY={p.rotY} accent={style.accent} />
        ))}
        <Sparkles count={34} scale={[HALF_W * 2 - 1, 3, Math.min(length, 44)]} position={[0, 2.2, -Math.min(length, 44) / 2]} size={2} speed={0.2} opacity={0.3} color={style.mote} />
      </Suspense>
      {tour ? (
        <TourCam stops={tourStops} onFocus={(id) => onFocus(id ? byId[id] ?? null : null)} onEnd={onTourEnd} />
      ) : (
        <Player active={!tour} bounds={{ zMin: -length - 1 }} onFocus={(id) => onFocus(id ? byId[id] ?? null : null)} onInspect={(id) => byId[id] && onInspect(byId[id])} onLockChange={onLockChange} />
      )}
      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.25} intensity={0.45} mipmapBlur />
        <Vignette eskil={false} offset={0.3} darkness={0.65} />
      </EffectComposer>
    </Canvas>
  );
}
