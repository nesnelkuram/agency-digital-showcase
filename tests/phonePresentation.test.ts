import { describe, expect, it } from 'vitest';
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { getPhonePresentation } from '../utils/phonePresentation';

describe('selected phone framing', () => {
  it.each([
    [1440, 1000, false, 1.1],
    [1024, 768, false, 1.1],
    [768, 1024, false, 1.3],
    [844, 390, false, 1.3],
    [390, 844, true, 2.5],
    [320, 568, true, 2.5],
  ] as const)('keeps the whole phone upright inside %i × %i', (width, height, compact, parentScale) => {
    const camera = new PerspectiveCamera(compact ? 25 : 6.5, width / height, 0.1, 100);
    camera.position.set(...(compact ? [12, -6, 18] : [20, -12, 24.5]) as [number, number, number]);
    camera.rotation.set(...(compact ? [0.6, 0.55, 0.4] : [0.5, 0.7, 0.4]) as [number, number, number]);
    camera.updateMatrixWorld(true);
    const pose = getPhonePresentation(camera, width, height, parentScale, compact);
    const rotation = new Quaternion().setFromEuler(new Euler(pose.rotation.x, pose.rotation.y, pose.rotation.z));
    const center = new Vector3(pose.position.x, pose.position.y, pose.position.z).multiplyScalar(parentScale);
    const project = (x: number, y: number) => new Vector3(x, y, 0)
      .multiplyScalar(pose.scale * parentScale).applyQuaternion(rotation).add(center).project(camera);
    const upperLeft = project(-1.8 * 0.49 / 2, 0.9);
    const upperRight = project(1.8 * 0.49 / 2, 0.9);
    const lowerLeft = project(-1.8 * 0.49 / 2, -0.9);
    const lowerRight = project(1.8 * 0.49 / 2, -0.9);

    for (const point of [upperLeft, upperRight, lowerLeft, lowerRight]) {
      expect(Math.abs(point.x)).toBeLessThan(1);
      expect(Math.abs(point.y)).toBeLessThan(1);
    }
    expect(upperLeft.y).toBeCloseTo(upperRight.y, 8);
    expect(upperLeft.x).toBeCloseTo(lowerLeft.x, 8);
    expect(upperLeft.y).toBeGreaterThan(lowerLeft.y);
    // Keep clear of the close button/logo and the mobile project description.
    expect((1 - upperLeft.y) * height / 2).toBeGreaterThanOrEqual(79.99);
    expect((1 - lowerLeft.y) * height / 2).toBeLessThanOrEqual(height - (compact ? 199.99 : 47.99));
  });
});
