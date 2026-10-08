import { WebGLRenderer, Scene, PerspectiveCamera, Group, BufferGeometry, Float32BufferAttribute, LineLoop, LineBasicMaterial, Points, PointsMaterial, Color, Vector3 } from 'three';

// A quiet, orbital interpretation of a shared table. Content and interaction
// remain native HTML; this scene is only progressive visual enhancement.
export function createStrategyScene(canvas, container) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1 : 1.5));
  renderer.setClearColor(0x153e35, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.z = 8.2;
  const group = new Group();
  scene.add(group);
  const materials = [];
  for (let ring = 0; ring < 5; ring++) {
    const positions = [];
    for (let i = 0; i < 160; i++) {
      const angle = i / 160 * Math.PI * 2;
      positions.push(Math.cos(angle) * (2.05 + ring * .065), Math.sin(angle) * (2.05 + ring * .065), 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color: 0xc4b690, transparent: true, opacity: ring === 0 ? .45 : .18, depthWrite: false });
    materials.push(material);
    const line = new LineLoop(geometry, material);
    line.rotation.x = .7 + ring * .36;
    line.rotation.y = ring * .46;
    line.rotation.z = ring * .27;
    group.add(line);
  }
  const particlePositions = [];
  for (let i = 0; i < 50; i++) {
    const angle = i * 2.399963;
    const radius = 1.85 + (i % 7) * .075;
    particlePositions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(i * 2.1) * .55);
  }
  const dots = new BufferGeometry();
  dots.setAttribute('position', new Float32BufferAttribute(particlePositions, 3));
  const dotMaterial = new PointsMaterial({ color: 0xe4cf97, size: .025, transparent: true, opacity: .6, sizeAttenuation: true, depthWrite: false });
  group.add(new Points(dots, dotMaterial));
  let motion = true;
  let visible = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let targetRotation = 0;
  const pointer = new Vector3();
  function resize() {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.position.z = camera.aspect < .9 ? 9.9 : 8.2;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function animate(time) {
    frame = 0;
    if (!visible || !motion) return;
    if (time - last >= 32) {
      elapsed += Math.min((time - last) / 1000, .05);
      last = time;
      group.rotation.z += (targetRotation + Math.sin(elapsed * .12) * .08 - group.rotation.z) * .028;
      group.rotation.y += (pointer.x * .12 - group.rotation.y) * .025;
      group.rotation.x += (pointer.y * .12 - group.rotation.x) * .025;
      group.children.forEach((child, index) => { if (index < 5) child.rotation.z += .00065 * (index % 2 ? 1 : -1); });
      renderer.render(scene, camera);
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
  resize();
  container.classList.add('has-webgl');
  return {
    setMotion(value) { motion = value; schedule(); },
    setLayer(index) {
      targetRotation = index * Math.PI / 3;
      materials.forEach((material, i) => { material.opacity = i === index % 5 ? .5 : .2; material.color.copy(new Color(index % 2 ? 0xd1b684 : 0xc4b690)); });
      if (!motion) renderer.render(scene, camera);
    },
    dispose() { motion = false; schedule(); observer.disconnect(); resizer.disconnect(); container.removeEventListener('pointermove', onMove); group.children.forEach(child => { child.geometry.dispose(); child.material.dispose(); }); renderer.dispose(); }
  };
}
