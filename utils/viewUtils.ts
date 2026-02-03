import type { CameraControls } from '@react-three/drei';
import { Axis } from '../types';
import { Vector3, MathUtils, PerspectiveCamera, OrthographicCamera } from 'three';

// Helper to determine if we are currently looking roughly at an axis
const getApproximateAxis = (controls: CameraControls): Axis | null => {
  const pos = new Vector3();
  const target = new Vector3();
  
  controls.getPosition(pos);
  controls.getTarget(target);
  
  // Calculate relative position (Eye - Target) so detection works even when panned
  pos.sub(target);
  
  const maxComp = Math.max(Math.abs(pos.x), Math.abs(pos.y), Math.abs(pos.z));
  
  if (Math.abs(pos.x) === maxComp) return pos.x > 0 ? 'X' : '-X';
  if (Math.abs(pos.y) === maxComp) return pos.y > 0 ? 'Y' : '-Y';
  if (Math.abs(pos.z) === maxComp) return pos.z > 0 ? 'Z' : '-Z';
  return null;
};

export const transitionToAxis = (controls: CameraControls | null, axisBase: 'X' | 'Y' | 'Z') => {
  if (!controls) return;

  const currentAxis = getApproximateAxis(controls);
  let targetAxis: Axis = axisBase;

  // Toggle logic: If already at +X, go to -X.
  if (currentAxis === axisBase) {
    targetAxis = `-${axisBase}` as Axis;
  }

  // 1. Capture current state
  const currentTarget = new Vector3();
  controls.getTarget(currentTarget); // Get the point we are currently orbiting
  const dist = controls.distance;    // Keep the current zoom distance

  // 2. Calculate offset vector based on desired axis
  const offset = new Vector3();
  // Z-UP Logic
  switch (targetAxis) {
    case 'X': offset.set(dist, 0, 0); break;    // Right View
    case '-X': offset.set(-dist, 0, 0); break;  // Left View
    case 'Y': offset.set(0, dist, 0); break;    // Back View
    case '-Y': offset.set(0, -dist, 0); break;  // Front View
    case 'Z': offset.set(0, 0, dist); break;    // Top View
    case '-Z': offset.set(0, 0, -dist); break;  // Bottom View
  }

  // 3. Calculate new camera position relative to the CURRENT target
  const newEye = currentTarget.clone().add(offset);

  // 4. Move camera to new position, but keep looking at the SAME target
  controls.setLookAt(newEye.x, newEye.y, newEye.z, currentTarget.x, currentTarget.y, currentTarget.z, true);
};

export const apply1to1Scale = (
  controls: CameraControls | null, 
  ppi: number
) => {
  if (!controls || !controls.camera) return;
  
  // Guard against invalid PPI
  if (!ppi || ppi <= 0) return;

  const PPM = ppi / 25.4;
  const camera = controls.camera;

  if (camera.type === 'OrthographicCamera') {
    // Orthographic: Zoom controls scale directly. 
    controls.zoomTo(PPM, true);
  } else {
    // Perspective: Distance controls scale.
    const cam = camera as PerspectiveCamera;
    
    // Safety check for FOV to avoid division by zero or NaN
    if (!cam.fov) return; 

    const fovRad = (cam.fov * Math.PI) / 180;
    const canvasHeight = window.innerHeight;
    
    const visibleHeightMM = canvasHeight / PPM;
    const requiredDistance = visibleHeightMM / (2 * Math.tan(fovRad / 2));
    
    controls.dollyTo(requiredDistance, true);
  }
};

// --- Visual Continuity Helpers ---

export const getVisibleHeightAtTarget = (controls: CameraControls, canvasHeight: number): number => {
  const camera = controls.camera;
  if (!camera) return 0;

  if (camera.type === 'PerspectiveCamera') {
    const persp = camera as PerspectiveCamera;
    const dist = controls.distance; 
    // Ensure FOV is valid
    if (!persp.fov) return 0;
    
    const fovRad = MathUtils.degToRad(persp.fov);
    return 2 * dist * Math.tan(fovRad / 2);

  } else if (camera.type === 'OrthographicCamera') {
    const ortho = camera as OrthographicCamera;
    // Prevent division by zero if zoom is somehow 0
    if (!ortho.zoom) return 0;
    return canvasHeight / ortho.zoom;
  }
  return 0;
};

export const setVisibleHeightAtTarget = (controls: CameraControls, visibleHeight: number, canvasHeight: number) => {
  const camera = controls.camera;
  if (!camera || visibleHeight <= 0 || canvasHeight <= 0) return;

  if (camera.type === 'PerspectiveCamera') {
    const persp = camera as PerspectiveCamera;
    if (!persp.fov) return;

    const fovRad = MathUtils.degToRad(persp.fov);
    const targetDist = visibleHeight / (2 * Math.tan(fovRad / 2));
    
    // Check for Infinity/NaN before applying
    if (Number.isFinite(targetDist)) {
      controls.dollyTo(targetDist, false); 
    }

  } else if (camera.type === 'OrthographicCamera') {
    const zoom = canvasHeight / visibleHeight;
    
    if (Number.isFinite(zoom)) {
      controls.zoomTo(zoom, false); 
    }
  }
};
