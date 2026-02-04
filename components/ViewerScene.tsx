import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Environment, Grid, Text } from '@react-three/drei';
import { 
  MathUtils, 
  PerspectiveCamera, 
  OrthographicCamera, 
  ACESFilmicToneMapping
} from 'three';
import { useStore } from '../store';
import { ModelWrapper } from './Model';
import { ErrorBoundary } from './ErrorBoundary';

// Augment global JSX namespace to fix R3F type errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      directionalLight: any;
      primitive: any;
      spotLight: any;
      rectAreaLight: any;
    }
  }
}

// Camera Controls Actions
const ACTION = {
  NONE: 0,
  ROTATE: 1,
  TRUCK: 2,
  OFFSET: 3,
  DOLLY: 4,
  ZOOM: 5,
  TOUCH_ROTATE: 6,
  TOUCH_TRUCK: 7,
  TOUCH_OFFSET: 8,
  TOUCH_DOLLY: 9,
  TOUCH_ZOOM: 10,
  TOUCH_DOLLY_TRUCK: 11,
  TOUCH_ZOOM_TRUCK: 12,
  TOUCH_DOLLY_OFFSET: 13,
  TOUCH_ZOOM_OFFSET: 14,
};

// Fallback component for failed models
const ErrorFallback: React.FC<{ fileName: string }> = ({ fileName }) => {
    return (
        <group>
            <mesh>
                <boxGeometry args={[20, 20, 20]} />
                <meshStandardMaterial color="#ff3333" wireframe />
            </mesh>
            <Text 
                position={[0, 25, 0]} 
                fontSize={5} 
                color="#ff3333"
                anchorX="center"
                anchorY="middle"
            >
                Error: {fileName}
            </Text>
        </group>
    );
};

const SceneContent: React.FC<{ 
  onMountControls: (controls: CameraControls) => void 
}> = ({ onMountControls }) => {
  const controlsRef = useRef<CameraControls>(null);
  const lastCheckTime = useRef(0);
  const { invalidate, camera, size } = useThree();
  
  const models = useStore((state) => state.models);
  const isGridVisible = useStore((state) => state.isGridVisible);
  const ppi = useStore((state) => state.ppi);
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);
  
  // Optimization: Cache PPM (Pixels Per Millimeter) calculation
  const ppm = useMemo(() => ppi / 25.4, [ppi]);

  // Optimization: Pre-calculate perspective factor to avoid trig in the loop
  // idealDistance = height / (2 * tan(fov/2) * ppm)
  // factor = 1 / (2 * tan(fov/2) * ppm)
  const perspectiveFactor = useMemo(() => {
    if (camera.type === 'PerspectiveCamera') {
        const cam = camera as PerspectiveCamera;
        if (cam.fov) {
            const fovRad = MathUtils.degToRad(cam.fov);
            return 1 / (2 * Math.tan(fovRad / 2) * ppm);
        }
    }
    return 0;
  }, [camera, ppm]);

  // Optimization: Stabilize function reference to prevent re-creation on every render
  const check1to1Scale = useCallback(() => {
    // Optimization: Skip if tab is hidden
    if (document.visibilityState !== 'visible') return;

    // Optimization: Throttle execution to ~10fps (every 100ms)
    const now = performance.now();
    if (now - lastCheckTime.current < 100) return;
    lastCheckTime.current = now;

    // Access store state imperatively to avoid dependency thrashing
    const state = useStore.getState();
    
    if (state.isCalibrationModalOpen) {
        if (state.is1to1Mode) state.set1to1Mode(false);
        return;
    }
    
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    const tolerance = 0.015; 
    let isMatch = false;
    
    if (camera.type === 'PerspectiveCamera') {
        // Use pre-calculated factor and current canvas height
        const idealDist = size.height * perspectiveFactor;
        if (idealDist > 0) isMatch = (Math.abs(controls.distance - idealDist) / idealDist) < tolerance;
    } else if (camera.type === 'OrthographicCamera') {
        // For Ortho, zoom directly corresponds to PPM
        const cam = camera as OrthographicCamera;
        if (cam.zoom) {
            isMatch = Math.abs(cam.zoom - ppm) / ppm < tolerance;
        }
    }
    
    // Only update store if value actually changes
    if (state.is1to1Mode !== isMatch) state.set1to1Mode(isMatch);
  }, [ppm, perspectiveFactor, size.height, camera]); // Re-create only when geometry/calibration changes

  // Trigger check when PPI or Modal state changes specifically
  useEffect(() => { check1to1Scale(); }, [check1to1Scale, ppi, isCalibrationModalOpen]);
  
  return (
    <>
      <CameraControls 
        ref={(node) => {
          controlsRef.current = node;
          if (node) {
             // --- SETUP CONFIG ---
             node.dollyToCursor = true;
             node.minZoom = 0.01;
             node.maxZoom = 5000;
             node.mouseButtons.middle = ACTION.TRUCK as any;
             node.mouseButtons.right = ACTION.TRUCK as any;
             
             // Manually set properties that are not exposed via props in the current types
             node.smoothTime = 0.25;
             node.draggingSmoothTime = 0.25;
             
             // --- DEMAND LOOP PATCHING ---
             // Only patch if we haven't already (in case of re-renders/refs)
             if (!(node as any).__patched) {
                 (node as any).__patched = true;

                 // 1. PATCH TRANSITION METHODS
                 // Ensure the demand loop stays active during programmatic animations.
                 const methods = ['setLookAt', 'dollyTo', 'zoomTo', 'moveTo', 'rotateTo', 'truck', 'dolly', 'zoom'];
                 methods.forEach((method) => {
                     const original = (node as any)[method];
                     if (typeof original === 'function') {
                         (node as any)[method] = (...args: any[]) => {
                             // Kickstart the loop immediately
                             invalidate();
                             
                             const result = original.apply(node, args);
                             
                             if (result instanceof Promise) {
                                 // Keep the loop running at 60fps while the promise is pending (animation active)
                                 const interval = setInterval(invalidate, 15);
                                 result.finally(() => {
                                     // Continue briefly after completion to allow damping to settle
                                     setTimeout(() => clearInterval(interval), 200);
                                 });
                             }
                             return result;
                         };
                     }
                 });

                 // 2. PATCH UPDATE LOOP
                 // Fix "Sudden Snap" on wake-up for ALL refresh rates (60Hz, 120Hz, 144Hz, etc.)
                 // When the loop wakes after idle, `delta` is huge (e.g., 5 seconds).
                 // We clamp this to 0.01s (10ms).
                 // 10ms is safe because:
                 // - On 60Hz (16.6ms frame): It moves slightly less than 1 frame. Smooth.
                 // - On 120Hz (8.3ms frame): It moves approx 1.2 frames. Smooth.
                 // - On 240Hz (4.1ms frame): It moves approx 2.5 frames. Still visually instantaneous.
                 const originalUpdate = (node as any).update;
                 (node as any).update = (delta: number) => {
                     // If delta > 50ms, assume we just woke up from demand sleep.
                     // Feed it a safe 10ms step to initiate momentum without snapping.
                     const safeDelta = delta > 0.05 ? 0.01 : delta;
                     
                     const updated = originalUpdate.call(node, safeDelta);
                     
                     // If the camera moved, request another frame to keep the animation going.
                     if (updated) {
                         invalidate();
                     }
                     return updated;
                 };
             }

             onMountControls(node);
          }
        }}
        makeDefault 
        onChange={(e) => {
            // Invalidate on user interaction to render new frames
            invalidate();
            check1to1Scale(); 
        }}
      />
      
      <Environment preset="city" blur={0.8} />

      {/* Lighting Setup */}
      {/* Ambient light for base visibility */}
      <ambientLight intensity={0.7} />
      
      {/* Single Light Source (No Shadows) */}
      <directionalLight 
        position={[50, 50, 200]} 
        intensity={1.1} 
        color="#ffffff" 
      />

      {isGridVisible && (
          <Grid
            // LOCKED to origin to prevent sliding
            position={[0, 0, -0.05]} 
            rotation={[Math.PI / 2, 0, 0]}
            args={[1000, 1000]}
            cellSize={10}
            sectionSize={100}
            cellColor="#333333"
            sectionColor="#5a5a5a"
            cellThickness={0.8}
            sectionThickness={1.2}
            fadeDistance={450} 
            fadeStrength={1.5}
            infiniteGrid
            renderOrder={-10}
          />
      )}

      {models.map((model, index) => (
        <ErrorBoundary 
            key={model.id} 
            fallback={<ErrorFallback fileName={model.file.name} />}
            onError={(e) => console.warn(`Model failed to load: ${model.file.name}`, e)}
        >
            <React.Suspense fallback={null}>
                <ModelWrapper modelData={model} index={index} />
            </React.Suspense>
        </ErrorBoundary>
      ))}
    </>
  );
};

export const ViewerScene: React.FC<{ 
  controlsRef: React.MutableRefObject<CameraControls | null> 
}> = ({ controlsRef }) => {
  const selectModel = useStore((state) => state.selectModel);

  return (
    <div className="w-full h-full relative bg-[#000000]">
      <Canvas
        dpr={[1, 2]}
        orthographic
        frameloop="demand"
        // Shadows disabled
        style={{ touchAction: 'none' }}
        camera={{
            up: [0, 0, 1],
            position: [200, -200, 200], 
            zoom: 5.0,
            near: -500, 
            far: 1000 
        }}
        gl={{ 
            preserveDrawingBuffer: true, 
            antialias: true, 
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.0, 
            precision: 'highp',
            powerPreference: 'high-performance',
        }}
        onPointerMissed={(e) => { if (e.type === 'click') selectModel(null); }}
      >
        <SceneContent onMountControls={(ctrl) => { controlsRef.current = ctrl; }} />
      </Canvas>
    </div>
  );
};