import type { CameraControls } from '@react-three/drei';
import { Axis } from '../types';
import { Vector3, PerspectiveCamera } from 'three';

const getApproximateAxis = (controls: CameraControls): Axis | null => {
  const pos = new Vector3();
  const target = new Vector3();

  controls.getPosition(pos);
  controls.getTarget(target);

  // Use relative position (Eye - Target) so detection works even when panned.
  pos.sub(target);

  const absX = Math.abs(pos.x);
  const absY = Math.abs(pos.y);
  const absZ = Math.abs(pos.z);
  const maxComp = Math.max(absX, absY, absZ);

  if (absX === maxComp) return pos.x > 0 ? 'X' : '-X';
  if (absY === maxComp) return pos.y > 0 ? 'Y' : '-Y';
  if (absZ === maxComp) return pos.z > 0 ? 'Z' : '-Z';
  return null;
};

export const transitionToAxis = (
  controls: CameraControls | null,
  axisBase: 'X' | 'Y' | 'Z'
) => {
  if (!controls) return;

  const currentAxis = getApproximateAxis(controls);
  const targetAxis: Axis = currentAxis === axisBase ? (`-${axisBase}` as Axis) : axisBase;

  const currentTarget = new Vector3();
  controls.getTarget(currentTarget);
  const dist = controls.distance;

  const offset = new Vector3();
  // Z-up coordinate system
  switch (targetAxis) {
    case 'X':
      offset.set(dist, 0, 0);
      break;
    case '-X':
      offset.set(-dist, 0, 0);
      break;
    case 'Y':
      offset.set(0, dist, 0);
      break;
    case '-Y':
      offset.set(0, -dist, 0);
      break;
    case 'Z':
      offset.set(0, 0, dist);
      break;
    case '-Z':
      offset.set(0, 0, -dist);
      break;
  }

  const newEye = currentTarget.clone().add(offset);
  controls.setLookAt(
    newEye.x,
    newEye.y,
    newEye.z,
    currentTarget.x,
    currentTarget.y,
    currentTarget.z,
    true
  );
};

export const apply1to1Scale = (
  controls: CameraControls | null,
  ppi: number,
  canvasHeight: number = typeof window !== 'undefined' ? window.innerHeight : 0
) => {
  if (!controls || !controls.camera) return;
  if (!ppi || ppi <= 0) return;

  const ppm = ppi / 25.4;
  const camera = controls.camera;

  if (camera.type === 'OrthographicCamera') {
    controls.zoomTo(ppm, true);
  } else {
    const cam = camera as PerspectiveCamera;
    if (!cam.fov || canvasHeight <= 0) return;

    const fovRad = (cam.fov * Math.PI) / 180;
    const visibleHeightMM = canvasHeight / ppm;
    const requiredDistance = visibleHeightMM / (2 * Math.tan(fovRad / 2));

    controls.dollyTo(requiredDistance, true);
  }
};
