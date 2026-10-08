import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Studio tanıtım sahnesi.
 * Ortada marka hafızası (çekirdek), etrafında beş aşamanın ajan yörüngeleri.
 * Her yörüngede bir insan onayı kapısı var; kapıdan geçen parçacık kobalttan kehribara döner.
 */

export const LANES = [
  { name: 'Diagnose', r: 1.85, tilt: [0.35, 0, 0.15], speed: 0.22, gate: 0.6 },
  { name: 'Strategy', r: 2.3, tilt: [-0.5, 0, 0.35], speed: 0.17, gate: 2.1 },
  { name: 'Present', r: 2.75, tilt: [0.9, 0, -0.25], speed: 0.13, gate: 3.6 },
  { name: 'Execute', r: 3.2, tilt: [-0.2, 0, -0.6], speed: 0.11, gate: 4.9 },
  { name: 'Learn', r: 3.65, tilt: [0.6, 0, 0.75], speed: 0.09, gate: 5.8 },
] as const;

const COBALT = new THREE.Color('#2B45E6');
const AMBER = new THREE.Color('#E8A13A');

const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const laneMatrix = (tilt: readonly number[]) =>
  new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt[0], tilt[1], tilt[2])));

const gatePosition = (i: number) => {
  const l = LANES[i];
  return new THREE.Vector3(Math.cos(l.gate) * l.r, 0, Math.sin(l.gate) * l.r).applyMatrix3(laneMatrix(l.tilt));
};

/* ------------------------------ Çekirdek ------------------------------ */

const BrandCore: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uCobalt: { value: COBALT },
      uAmber: { value: AMBER },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!reduced) uniforms.uTime.value += delta;
    const p = state.pointer;
    const target = Math.min(1, Math.hypot(p.x, p.y));
    uniforms.uEnergy.value += (target - uniforms.uEnergy.value) * 0.04;
    if (mesh.current && !reduced) mesh.current.rotation.y += delta * 0.08;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.1, 48]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          uniform float uTime; uniform float uEnergy;
          varying vec3 vNormalV; varying float vNoise;
          ${SNOISE}
          void main(){
            float n = snoise(position * 0.9 + vec3(uTime * 0.18));
            float n2 = snoise(position * 2.6 - vec3(uTime * 0.15));
            float disp = (n * 0.1 + n2 * 0.025) * (1.0 + uEnergy * 0.8);
            vNoise = n;
            vNormalV = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * disp, 1.0);
          }`}
        fragmentShader={/* glsl */ `
          uniform vec3 uCobalt; uniform vec3 uAmber;
          varying vec3 vNormalV; varying float vNoise;
          void main(){
            float fres = pow(1.0 - max(dot(normalize(vNormalV), vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
            vec3 pearl = mix(vec3(0.975, 0.98, 0.99), vec3(0.80, 0.84, 0.97), 0.5 + 0.5 * vNoise);
            float light = 0.82 + 0.18 * dot(normalize(vNormalV), normalize(vec3(-0.4, 0.8, 0.6)));
            vec3 col = pearl * light;
            col = mix(col, uCobalt, fres * 0.7);
            float band = smoothstep(0.44, 0.49, vNoise) * (1.0 - smoothstep(0.49, 0.54, vNoise));
            col = mix(col, uAmber, band * 0.55);
            gl_FragColor = vec4(col, 1.0);
          }`}
      />
    </mesh>
  );
};

/* ------------------------------ Yörüngeler ------------------------------ */

const AgentSwarm: React.FC<{ count: number; glow: React.MutableRefObject<number[]>; reduced: boolean }> = ({
  count,
  glow,
  reduced,
}) => {
  const { gl } = useThree();
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const lane = new Float32Array(count);
    const phase = new Float32Array(count);
    const jitter = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Dış yörüngeler daha uzun, daha fazla parçacık alır
      const l = Math.min(4, Math.floor(Math.pow(Math.random(), 0.8) * 5));
      lane[i] = l;
      phase[i] = Math.random();
      jitter[i * 3] = (Math.random() - 0.5) * 0.16;
      jitter[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      size[i] = 0.6 + Math.random() * 1.4;
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aLane', new THREE.BufferAttribute(lane, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aJitter', new THREE.BufferAttribute(jitter, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: gl.getPixelRatio() },
      uRot: { value: LANES.map((l) => laneMatrix(l.tilt)) },
      uR: { value: LANES.map((l) => l.r) },
      uSpeed: { value: LANES.map((l) => l.speed) },
      uGate: { value: LANES.map((l) => l.gate) },
      uGlow: { value: [0.5, 0.5, 0.5, 0.5, 0.5] },
      uCobalt: { value: COBALT },
      uAmber: { value: AMBER },
    }),
    [gl],
  );

  useFrame((_, delta) => {
    if (!reduced) uniforms.uTime.value += delta;
    const k = reduced ? 1 : 0.06;
    for (let i = 0; i < 5; i++) uniforms.uGlow.value[i] += (glow.current[i] - uniforms.uGlow.value[i]) * k;
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={/* glsl */ `
          attribute float aLane; attribute float aPhase; attribute vec3 aJitter; attribute float aSize;
          uniform float uTime; uniform float uPixelRatio;
          uniform mat3 uRot[5]; uniform float uR[5]; uniform float uSpeed[5]; uniform float uGate[5]; uniform float uGlow[5];
          varying float vAmber; varying float vGlow;
          void main(){
            int li = int(aLane + 0.5);
            float a = aPhase * 6.2831853 + uTime * uSpeed[li];
            float r = uR[li] + aJitter.x;
            vec3 p = uRot[li] * vec3(cos(a) * r, aJitter.y, sin(a) * r);
            // Kapıdan hemen sonra: onaylanmış iş, kehribar
            float d = mod(a - uGate[li], 6.2831853);
            vAmber = smoothstep(0.0, 0.04, d) * (1.0 - smoothstep(0.04, 1.1, d));
            vGlow = uGlow[li];
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPixelRatio * (0.9 + vGlow * 1.1 + vAmber * 1.0) * (8.0 / -mv.z);
          }`}
        fragmentShader={/* glsl */ `
          uniform vec3 uCobalt; uniform vec3 uAmber;
          varying float vAmber; varying float vGlow;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float soft = 1.0 - smoothstep(0.15, 0.5, d);
            vec3 col = mix(uCobalt, uAmber, vAmber);
            gl_FragColor = vec4(col, soft * (0.18 + vGlow * 0.75));
          }`}
      />
    </points>
  );
};

const OrbitLines: React.FC<{ glow: React.MutableRefObject<number[]> }> = ({ glow }) => {
  const lines = useMemo(
    () =>
      LANES.map((l) => {
        const pts: THREE.Vector3[] = [];
        const m = laneMatrix(l.tilt);
        for (let i = 0; i < 160; i++) {
          const a = (i / 160) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * l.r, 0, Math.sin(a) * l.r).applyMatrix3(m));
        }
        const mat = new THREE.LineBasicMaterial({ color: '#1A1F2E', transparent: true, opacity: 0.1 });
        return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
      }),
    [],
  );

  useFrame(() => {
    lines.forEach((line, i) => {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity += (0.05 + glow.current[i] * 0.22 - mat.opacity) * 0.08;
    });
  });

  return (
    <>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </>
  );
};

const GateNode: React.FC<{ index: number; active: number }> = ({ index, active }) => {
  const ref = useRef<THREE.Group>(null);
  const label = useRef<HTMLSpanElement>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => gatePosition(index), [index]);
  const on = active === index;

  // Çekirdeğin arkasına geçen kapının etiketi söner
  useFrame(() => {
    if (!ref.current || !label.current) return;
    ref.current.getWorldPosition(world);
    const behind = THREE.MathUtils.smoothstep(world.z, -1.2, 0.4);
    const base = active >= 0 && !on ? 0.3 : 1;
    label.current.style.opacity = String(base * behind);
  });

  return (
    <group ref={ref} position={p}>
      <mesh>
        <sphereGeometry args={[on ? 0.075 : 0.05, 20, 20]} />
        <meshBasicMaterial color={AMBER} />
      </mesh>
      <Html center zIndexRange={[2, 0]} style={{ pointerEvents: 'none' }}>
        <span ref={label} className={`sl-gate-label${on ? ' is-on' : ''}`}>
          {index + 1} {LANES[index].name}
        </span>
      </Html>
    </group>
  );
};

const Gates: React.FC<{ active: number }> = ({ active }) => (
  <>
    {LANES.map((l, i) => (
      <GateNode key={l.name} index={i} active={active} />
    ))}
  </>
);

/* ------------------------------ Kamera / sahne ------------------------------ */

const shortestAngle = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const Rig: React.FC<{ active: number; mobile: boolean; reduced: boolean; children: React.ReactNode }> = ({
  active,
  mobile,
  reduced,
  children,
}) => {
  const group = useRef<THREE.Group>(null);
  const idle = useRef(0);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [active, invalidate]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const k = reduced ? 1 : 1 - Math.pow(0.04, delta);

    let targetY: number;
    if (active >= 0) {
      const p = gatePosition(active);
      const gateAz = Math.atan2(p.x, p.z);
      targetY = (mobile ? 0.1 : -0.35) - gateAz;
      idle.current = targetY;
    } else {
      if (!reduced) idle.current += delta * 0.05;
      targetY = idle.current;
    }
    g.rotation.y += shortestAngle(g.rotation.y, targetY) * k;

    const px = reduced ? 0 : state.pointer.x;
    const py = reduced ? 0 : state.pointer.y;
    g.rotation.x += (0.18 + py * 0.08 - g.rotation.x) * k;
    g.rotation.z += (-px * 0.05 - g.rotation.z) * k;

    const tx = mobile ? 0 : active >= 0 ? 2.1 : 1.7;
    const ty = mobile ? (active >= 0 ? 2.1 : 2.6) : 0.15;
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;

    const tz = active >= 0 ? (mobile ? 11.5 : 7.2) : mobile ? 13 : 8.4;
    camera.position.z += (tz - camera.position.z) * k;
    camera.lookAt(0, 0, 0);
  });

  return <group ref={group}>{children}</group>;
};

interface CoreSceneProps {
  active: number;
  mobile: boolean;
  reduced: boolean;
}

const CoreScene: React.FC<CoreSceneProps> = ({ active, mobile, reduced }) => {
  const glow = useRef<number[]>([0.5, 0.5, 0.5, 0.5, 0.5]);
  glow.current = LANES.map((_, i) => (active < 0 ? 0.5 : i === active ? 1 : 0.12));

  return (
    <Canvas
      camera={{ position: [0, 0, 8.4], fov: 40 }}
      dpr={mobile ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={reduced ? 'demand' : 'always'}
    >
      <Rig active={active} mobile={mobile} reduced={reduced}>
        <BrandCore reduced={reduced} />
        <OrbitLines glow={glow} />
        <AgentSwarm count={mobile ? 1600 : 4200} glow={glow} reduced={reduced} />
        <Gates active={active} />
      </Rig>
    </Canvas>
  );
};

export default CoreScene;
