import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, LatheGeometry, Vector2, MeshPhysicalMaterial,
  TextureLoader, SRGBColorSpace, DirectionalLight, AmbientLight, PMREMGenerator, ACESFilmicToneMapping,
  BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, AdditiveBlending, MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Oro di Milas Reserve şişesi. Geometri, ürün fotoğrafından çıkarılan dönel profilden;
// desen, aynı fotoğraftan ayrıştırılan folyo ve lak katmanlarından gelir
// (scripts/orodimilas/prepare-bottle.py). Sahne kaydırma ilerlemesiyle yönetilir.

const BOTTLE_HEIGHT = 3;
const FOV = 30;
const CAMERA_Z = 7.6;

// Kaydırma ana kareleri. x: görünür genişliğin oranı, rotY: radyan.
const DESKTOP = [
  { p: 0.00, x: 0.00, y: -0.03, rotY: -0.35, rotZ: 0.00, scale: 0.98 },
  { p: 0.34, x: -0.21, y: -0.10, rotY: 0.18, rotZ: -0.03, scale: 1.16 },
  { p: 0.64, x: 0.21, y: -0.02, rotY: Math.PI * 2 + 0.06, rotZ: 0.03, scale: 1.08 },
  { p: 1.00, x: -0.20, y: -0.03, rotY: Math.PI * 2 + 0.5, rotZ: 0.00, scale: 1.00 },
];
const PORTRAIT = [
  { p: 0.00, x: 0, y: 0.00, rotY: -0.35, rotZ: 0.00, scale: 0.70 },
  { p: 0.34, x: 0, y: 0.11, rotY: 0.18, rotZ: -0.02, scale: 0.72 },
  { p: 0.64, x: 0, y: 0.12, rotY: Math.PI * 2 + 0.06, rotZ: 0.02, scale: 0.70 },
  { p: 1.00, x: 0, y: 0.13, rotY: Math.PI * 2 + 0.5, rotZ: 0.00, scale: 0.64 },
];
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function sample(keys, p) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i], b = keys[i + 1];
  const t = ease(MathUtils.clamp((p - a.p) / (b.p - a.p), 0, 1));
  const out = {};
  for (const k of ['x', 'y', 'rotY', 'rotZ', 'scale']) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

async function loadProfile(url) {
  const { points } = await (await fetch(url)).json();
  // Alt merkezden başlayıp kapak merkezinde kapanan dönel eğri.
  const curve = [new Vector2(0, 0), ...points.map(([y, r]) => new Vector2(r * BOTTLE_HEIGHT, y * BOTTLE_HEIGHT))];
  const top = curve[curve.length - 1];
  curve.push(new Vector2(top.x * 0.6, BOTTLE_HEIGHT), new Vector2(0, BOTTLE_HEIGHT));
  return curve;
}

export async function createBottleScene(canvas, container, { assetBase = '/orodimilas/assets/', intro: startWithIntro = true, introDelay = 0, onIntroDone } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, CAMERA_Z);

  // Işık: soldan ılık ana ışık, arkadan altın kenar ışıkları (fotoğraftaki kontur gibi).
  const key = new DirectionalLight(0xffffff, 2.2); key.position.set(-4, 3, 5); scene.add(key);
  const rimL = new DirectionalLight(0xe6c486, 2.4); rimL.position.set(-5, 1.5, -3); scene.add(rimL);
  const rimR = new DirectionalLight(0xdcbc7a, 1.9); rimR.position.set(5, 2, -3); scene.add(rimR);
  const top = new DirectionalLight(0xffffff, 0.8); top.position.set(0, 6, 2); scene.add(top);
  scene.add(new AmbientLight(0xffffff, 0.08));

  const loader = new TextureLoader();
  const [curve, albedo, rm] = await Promise.all([
    loadProfile(assetBase + 'bottle-profile.json'),
    loader.loadAsync(assetBase + 'bottle-albedo.jpg'),
    loader.loadAsync(assetBase + 'bottle-rm.jpg'),
  ]);
  albedo.colorSpace = SRGBColorSpace;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  albedo.anisotropy = rm.anisotropy = Math.min(8, aniso);

  // phiStart = π: dokunun ortası (u = 0.5) kameraya bakar.
  const geometry = new LatheGeometry(curve, 160, Math.PI, Math.PI * 2);
  const material = new MeshPhysicalMaterial({
    map: albedo, roughnessMap: rm, metalnessMap: rm,
    roughness: 1, metalness: 1,
    clearcoat: 0.35, clearcoatRoughness: 0.45,
  });
  const bottle = new Mesh(geometry, material);
  bottle.position.y = -BOTTLE_HEIGHT / 2;
  const pivot = new Group();
  pivot.rotation.order = 'ZYX'; // Y dönüşü şişenin kendi ekseninde, Z eğimi dışarıda.
  pivot.add(bottle);
  scene.add(pivot);

  // Şişenin çevresinde ağır ağır süzülen altın toz.
  const dustCount = 140;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const a = i * 2.399963, r = 1.1 + (i % 9) * 0.18;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = ((i * 37) % 100) / 100 * 4 - 2;
    dustPos[i * 3 + 2] = Math.sin(a) * r * 0.6 - 0.6;
    dustSeed[i] = (i * 13.37) % 1;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(dustPos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({ color: 0xe6c47c, size: 0.022, transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending }));
  scene.add(dust);

  let target = 0, current = 0, elapsed = 0, last = 0, frame = 0;
  // Giriş: şişe aşağıdan, iki tur dönerek ve büyüyerek ilk pozuna yerleşir.
  const INTRO_SECONDS = 2.6;
  let intro = 0;
  let introWait = introDelay / 1000;
  function finishIntro() { container.dataset.intro = 'done'; onIntroDone?.(); }
  let motion = true, visible = true, portrait = false, visibleWidth = 1;

  function apply(t) {
    const s = sample(portrait ? PORTRAIT : DESKTOP, current);
    const sway = motion ? Math.sin(t * 0.45) * 0.05 : 0;
    const float = motion ? Math.sin(t * 0.8) * 0.025 : 0;
    const visibleHeight = 2 * CAMERA_Z * Math.tan(MathUtils.degToRad(FOV / 2));
    const e = 1 - Math.pow(1 - intro, 4);
    const rest = 1 - e;
    pivot.position.set(s.x * visibleWidth, s.y * visibleHeight + float - rest * visibleHeight * 0.85, 0);
    pivot.rotation.set(0, s.rotY + sway - rest * Math.PI * 4, s.rotZ + rest * 0.22);
    pivot.scale.setScalar(s.scale * (0.72 + 0.28 * e));
    if (motion) {
      const attr = dustGeo.getAttribute('position');
      for (let i = 0; i < dustCount; i++) {
        let y = attr.array[i * 3 + 1] + 0.0016 * (0.5 + dustSeed[i]);
        if (y > 2.1) y = -2.1;
        attr.array[i * 3 + 1] = y;
      }
      attr.needsUpdate = true;
      dust.rotation.y = t * 0.02;
    }
    renderer.render(scene, camera);
  }
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    portrait = camera.aspect < 0.9;
    visibleWidth = 2 * CAMERA_Z * Math.tan(MathUtils.degToRad(FOV / 2)) * camera.aspect;
    apply(elapsed);
  }
  function animate(time) {
    frame = 0;
    if (!visible) return;
    const dt = Math.min((time - last) / 1000, 0.05);
    last = time;
    elapsed += dt;
    if (introWait > 0) introWait -= dt;
    else if (intro < 1) {
      intro = Math.min(1, intro + dt / INTRO_SECONDS);
      if (intro === 1) finishIntro();
    }
    // Kaydırmaya yumuşak takip: Apple tarzı ataletli geçiş.
    current += (target - current) * (1 - Math.pow(0.0015, dt));
    apply(elapsed);
    if (motion || intro < 1 || Math.abs(target - current) > 0.0005) frame = requestAnimationFrame(animate);
  }
  function schedule() {
    if (visible && !frame) { last = performance.now(); frame = requestAnimationFrame(animate); }
    else if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: 0 });
  observer.observe(container);
  const resizer = new ResizeObserver(resize);
  resizer.observe(container);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); visible = false; schedule(); container.classList.remove('has-webgl'); });

  // Hareket kapalıysa giriş atlanır, şişe doğrudan yerinde görünür.
  if (!startWithIntro) { intro = 1; finishIntro(); }
  resize();
  container.classList.add('has-webgl');
  schedule();
  return {
    setProgress(p) { target = MathUtils.clamp(p, 0, 1); schedule(); },
    setMotion(value) { motion = value; schedule(); },
    dispose() {
      visible = false; schedule(); observer.disconnect(); resizer.disconnect();
      geometry.dispose(); material.dispose(); albedo.dispose(); rm.dispose(); dustGeo.dispose(); dust.material.dispose();
      scene.environment?.dispose(); renderer.dispose();
    },
  };
}
