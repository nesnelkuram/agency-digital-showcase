import { WebGLRenderer, Scene, PerspectiveCamera, Group, BufferGeometry, Float32BufferAttribute, LineLoop, LineBasicMaterial, Points, PointsMaterial, Vector3 } from 'three';

// "Tek kaynak, beş kanal": a golden core with oil-like threads flowing out to
// the five channel buttons. Buttons and copy remain native HTML; this scene is
// only progressive visual enhancement and mirrors the CSS node positions.
const NODE_COUNT = 5;
const FOV = 38;
const CAMERA_Z = 8.2;
// Node buttons sit on a circle whose radius is 40% of the (square) container.
const VISIBLE_HEIGHT = 2 * CAMERA_Z * Math.tan((FOV / 2) * Math.PI / 180);
const NODE_RADIUS = VISIBLE_HEIGHT * 0.4;

export const nodeAngle = index => -Math.PI / 2 + index * (Math.PI * 2 / NODE_COUNT);

export function createChannelScene(canvas, container) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1 : 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.z = CAMERA_Z;
  const group = new Group();
  scene.add(group);

  // Node targets in world space (screen-aligned, y up).
  const targets = Array.from({ length: NODE_COUNT }, (_, i) => new Vector3(Math.cos(nodeAngle(i)) * NODE_RADIUS, -Math.sin(nodeAngle(i)) * NODE_RADIUS, 0));

  // Orbit rings.
  const ringMaterials = [];
  for (let ring = 0; ring < 3; ring++) {
    const positions = [];
    const radius = NODE_RADIUS * (ring === 0 ? 1 : ring === 1 ? .62 : .3);
    for (let i = 0; i < 180; i++) {
      const angle = i / 180 * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color: 0xc9a75f, transparent: true, opacity: ring === 0 ? .32 : .14, depthWrite: false });
    ringMaterials.push(material);
    group.add(new LineLoop(geometry, material));
  }

  // Golden core: a soft particle sphere.
  const corePositions = [];
  for (let i = 0; i < 260; i++) {
    const y = 1 - (i / 259) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = i * 2.399963;
    const radius = .5 + (i % 5) * .025;
    corePositions.push(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius);
  }
  const coreGeometry = new BufferGeometry();
  coreGeometry.setAttribute('position', new Float32BufferAttribute(corePositions, 3));
  const core = new Points(coreGeometry, new PointsMaterial({ color: 0xe2c27a, size: .035, transparent: true, opacity: .75, sizeAttenuation: true, depthWrite: false }));
  group.add(core);

  // Flow particles travel along gentle curves from the core to each node.
  const PER_NODE = 26;
  const flowCount = PER_NODE * NODE_COUNT;
  const flowPositions = new Float32Array(flowCount * 3);
  const phases = new Float32Array(flowCount);
  for (let i = 0; i < flowCount; i++) phases[i] = (i % PER_NODE) / PER_NODE + Math.sin(i * 12.9898) * .02;
  const flowGeometry = new BufferGeometry();
  flowGeometry.setAttribute('position', new Float32BufferAttribute(flowPositions, 3));
  const flowMaterial = new PointsMaterial({ color: 0xd9b56a, size: .05, transparent: true, opacity: .8, sizeAttenuation: true, depthWrite: false });
  group.add(new Points(flowGeometry, flowMaterial));

  // Highlight particles cluster around the active node.
  const haloGeometry = new BufferGeometry();
  const haloPositions = new Float32Array(40 * 3);
  haloGeometry.setAttribute('position', new Float32BufferAttribute(haloPositions, 3));
  const haloMaterial = new PointsMaterial({ color: 0xf1dca4, size: .045, transparent: true, opacity: .85, sizeAttenuation: true, depthWrite: false });
  group.add(new Points(haloGeometry, haloMaterial));

  let active = 0;
  let motion = true;
  let visible = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  const pointer = new Vector3();
  const control = new Vector3();

  function updateFlows(t) {
    const attr = flowGeometry.getAttribute('position');
    for (let n = 0; n < NODE_COUNT; n++) {
      const target = targets[n];
      // Curve control point is pushed sideways so threads swirl like poured oil.
      control.set(target.x * .5 - target.y * .22, target.y * .5 + target.x * .22, .3);
      const speed = n === active ? .16 : .07;
      for (let k = 0; k < PER_NODE; k++) {
        const i = n * PER_NODE + k;
        const p = (phases[i] + t * speed) % 1;
        const a = (1 - p) * (1 - p), b = 2 * (1 - p) * p, c = p * p;
        attr.array[i * 3] = b * control.x + c * target.x;
        attr.array[i * 3 + 1] = b * control.y + c * target.y;
        attr.array[i * 3 + 2] = b * control.z + Math.sin((p + n) * 6) * .04 * (1 - a);
      }
    }
    attr.needsUpdate = true;
    const halo = haloGeometry.getAttribute('position');
    const target = targets[active];
    for (let i = 0; i < 40; i++) {
      const angle = i / 40 * Math.PI * 2 + t * .4;
      const radius = .34 + Math.sin(i * 3.1 + t) * .03;
      halo.array[i * 3] = target.x + Math.cos(angle) * radius;
      halo.array[i * 3 + 1] = target.y + Math.sin(angle) * radius;
      halo.array[i * 3 + 2] = 0;
    }
    halo.needsUpdate = true;
  }

  function render() { renderer.render(scene, camera); }
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    render();
  }
  function animate(time) {
    frame = 0;
    if (!visible || !motion) return;
    if (time - last >= 32) {
      elapsed += Math.min((time - last) / 1000, .05);
      last = time;
      core.rotation.y += .004;
      core.rotation.x = Math.sin(elapsed * .3) * .2;
      group.rotation.y += (pointer.x * .14 - group.rotation.y) * .03;
      group.rotation.x += (pointer.y * .14 - group.rotation.x) * .03;
      updateFlows(elapsed);
      render();
    }
    frame = requestAnimationFrame(animate);
  }
  function schedule() {
    if (visible && motion && !frame) { last = performance.now(); frame = requestAnimationFrame(animate); }
    else if ((!visible || !motion) && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: .05 });
  observer.observe(container);
  const resizer = new ResizeObserver(resize);
  resizer.observe(container);
  const onMove = event => { const rect = container.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width - .5, (event.clientY - rect.top) / rect.height - .5, 0); };
  container.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); motion = false; schedule(); container.classList.remove('has-webgl'); });
  updateFlows(0);
  resize();
  container.classList.add('has-webgl');
  return {
    setMotion(value) { motion = value; schedule(); if (!motion) render(); },
    setLayer(index) {
      active = index;
      updateFlows(elapsed);
      if (!motion) render();
    },
    dispose() {
      motion = false; schedule(); observer.disconnect(); resizer.disconnect();
      container.removeEventListener('pointermove', onMove);
      group.children.forEach(child => { child.geometry.dispose(); child.material.dispose(); });
      renderer.dispose();
    }
  };
}
