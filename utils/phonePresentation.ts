import { Euler, PerspectiveCamera, Vector3 } from 'three';

/** Fit the complete phone in a rectangle measured in canvas CSS pixels. */
export function getPhonePresentation(
  camera: PerspectiveCamera,
  width: number,
  height: number,
  parentScale: number,
  compact: boolean,
) {
  const left = compact ? 24 : width * 0.52;
  const right = width - (compact ? 24 : 40);
  const top = compact ? 80 : 96;
  const bottom = height - (compact ? 200 : 48);
  const distance = 12;
  const unitsPerPixel = 2 * distance * Math.tan(camera.fov * Math.PI / 360) / height;
  const phoneHeight = Math.max(80, Math.min(bottom - top, (right - left) / 0.49));
  const quaternion = camera.getWorldQuaternion(camera.quaternion.clone());
  const position = new Vector3(
    ((left + right) / 2 - width / 2) * unitsPerPixel,
    (height / 2 - (top + bottom) / 2) * unitsPerPixel,
    -distance,
  ).applyQuaternion(quaternion).add(camera.getWorldPosition(new Vector3())).divideScalar(parentScale);
  const rotation = new Euler().setFromQuaternion(quaternion);

  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
    scale: phoneHeight * unitsPerPixel / (1.8 * parentScale),
  };
}
