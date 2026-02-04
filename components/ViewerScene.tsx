import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Environment, Grid, Text } from '@react-three/drei';
// ... imports ...

// ... (ErrorFallback and ACTION constants remain the same) ...

const SceneContent: React.FC<{ 
  onMountControls: (controls: CameraControls) => void 
}> = ({ onMountControls }) => {
  const controlsRef = useRef<CameraControls>(null);
  const lastCheckTime = useRef(0);
  // 1. Get 'gl' from useThree to access the DOM element
  const { invalidate, camera, size, gl } = useThree(); 
  
  const models = useStore((state) => state.models);
  const isGridVisible = useStore((state) => state.isGridVisible);
  const ppi = useStore((state) => state.ppi);
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);
  
  // ... (Optimization logic for ppm and perspectiveFactor remains the same) ...
  const ppm = useMemo(() => ppi / 25.4, [ppi]);
  const perspectiveFactor = useMemo(() => {
    // ... (logic) ...
    if (camera.type === 'PerspectiveCamera') {
        const cam = camera as PerspectiveCamera;
        if (cam.fov) {
            const fovRad = MathUtils.degToRad(cam.fov);
            return 1 / (2 * Math.tan(fovRad / 2) * ppm);
        }
    }
    return 0;
  }, [camera, ppm]);

  const check1to1Scale = useCallback(() => {
    // ... (existing logic) ...
    if (document.visibilityState !== 'visible') return;
    const now = performance.now();
    if (now - lastCheckTime.current < 100) return;
    lastCheckTime.current = now;
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
        const idealDist = size.height * perspectiveFactor;
        if (idealDist > 0) isMatch = (Math.abs(controls.distance - idealDist) / idealDist) < tolerance;
    } else if (camera.type === 'OrthographicCamera') {
        const cam = camera as OrthographicCamera;
        if (cam.zoom) {
            isMatch = Math.abs(cam.zoom - ppm) / ppm < tolerance;
        }
    }
    if (state.is1to1Mode !== isMatch) state.set1to1Mode(isMatch);
  }, [ppm, perspectiveFactor, size.height, camera]);

  useEffect(() => { check1to1Scale(); }, [check1to1Scale, ppi, isCalibrationModalOpen]);

  // 2. FIX: Force wake-up on ANY user interaction.
  // In 'demand' mode, sometimes internal listeners fail to wake the loop if the state is "resting".
  // This manual listener ensures the moment you touch/scroll, the loop starts.
  useEffect(() => {
    const handleInteraction = () => invalidate();
    
    const el = gl.domElement;
    el.addEventListener('pointerdown', handleInteraction);
    el.addEventListener('wheel', handleInteraction);
    // Optional: Catch end of interaction to ensure damping finishes
    el.addEventListener('pointerup', handleInteraction); 
    
    return () => {
        el.removeEventListener('pointerdown', handleInteraction);
        el.removeEventListener('wheel', handleInteraction);
        el.removeEventListener('pointerup', handleInteraction);
    };
  }, [gl, invalidate]);

  return (
    <>
      <CameraControls 
        ref={(node) => {
          controlsRef.current = node;
          if (node) {
             // ... (Keep your existing patching logic here exactly as it was) ...
             node.dollyToCursor = true;
             node.minZoom = 0.01;
             node.maxZoom = 5000;
             node.mouseButtons.middle = ACTION.TRUCK as any;
             node.mouseButtons.right = ACTION.TRUCK as any;
             node.smoothTime = 0.25;
             node.draggingSmoothTime = 0.25;
             
             if (!(node as any).__patched) {
                 (node as any).__patched = true;

                 const methods = ['setLookAt', 'dollyTo', 'zoomTo', 'moveTo', 'rotateTo', 'truck', 'dolly', 'zoom'];
                 methods.forEach((method) => {
                     const original = (node as any)[method];
                     if (typeof original === 'function') {
                         (node as any)[method] = (...args: any[]) => {
                             invalidate();
                             const result = original.apply(node, args);
                             if (result instanceof Promise) {
                                 const interval = setInterval(invalidate, 15);
                                 result.finally(() => {
                                     setTimeout(() => clearInterval(interval), 200);
                                 });
                             }
                             return result;
                         };
                     }
                 });

                 const originalUpdate = (node as any).update;
                 (node as any).update = (delta: number) => {
                     const safeDelta = delta > 0.05 ? 0.01 : delta;
                     const updated = originalUpdate.call(node, safeDelta);
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
            invalidate();
            check1to1Scale(); 
        }}
      />
      
      {/* ... Rest of scene (Environment, Lights, Grid, Models) ... */}
      <Environment preset="city" blur={0.8} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[50, 50, 200]} intensity={1.1} color="#ffffff" />

      {isGridVisible && (
          <Grid
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
