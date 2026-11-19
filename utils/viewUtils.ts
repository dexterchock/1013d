import type { CameraControls } from '@react-three/drei';
import { Axis, Vec3 } from '../types';

const AXIS_ALIGNMENT_THRESHOLD = 0.99;

const getApproximateAxis = (controls: CameraControls): Axis | null => {
  const scratch = controls.camera?.position?.clone();
  if (!scratch) return null;

  const pos = controls.getPosition(controls.camera.position.clone());
  const target = controls.getTarget(scratch);

  // Use relative position (Eye - Target) so detection works even when panned.
  const dx = pos.x - target.x;
  const dy = pos.y - target.y;
  const dz = pos.z - target.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return null;

  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;

  if (Math.abs(nx) > AXIS_ALIGNMENT_THRESHOLD) return nx > 0 ? 'X' : '-X';
  if (Math.abs(ny) > AXIS_ALIGNMENT_THRESHOLD) return ny > 0 ? 'Y' : '-Y';
  if (Math.abs(nz) > AXIS_ALIGNMENT_THRESHOLD) return nz > 0 ? 'Z' : '-Z';
  return null;
};

export const transitionToAxis = (
  controls: CameraControls | null,
  axisBase: 'X' | 'Y' | 'Z'
) => {
  if (!controls || !controls.camera) return;

  const currentAxis = getApproximateAxis(controls);
  const targetAxis: Axis = currentAxis === axisBase ? (`-${axisBase}` as Axis) : axisBase;

  const currentTarget = controls.getTarget(controls.camera.position.clone());
  const dist = controls.distance;

  const offset: Vec3 = { x: 0, y: 0, z: 0 };
  // Z-up coordinate system
  switch (targetAxis) {
    case 'X':
      offset.x = dist;
      break;
    case '-X':
      offset.x = -dist;
      break;
    case 'Y':
      offset.y = dist;
      break;
    case '-Y':
      offset.y = -dist;
      break;
    case 'Z':
      offset.z = dist;
      break;
    case '-Z':
      offset.z = -dist;
      break;
  }

  controls.setLookAt(
    currentTarget.x + offset.x,
    currentTarget.y + offset.y,
    currentTarget.z + offset.z,
    currentTarget.x,
    currentTarget.y,
    currentTarget.z,
    true
  );
};

export const apply1to1Scale = (
  controls: CameraControls | null,
  ppi: number
) => {
  if (!controls || !controls.camera) return;
  if (!ppi || ppi <= 0) return;

  const ppm = ppi / 25.4;
  controls.zoomTo(ppm, true);
};
