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
}> = React.memo(({ onMountControls }) => {
  const controlsRef = useRef<CameraControls | null>(null);
  const lastCheckTime = useRef(0);
  
  // 1. Get 'gl' for your manual listeners
  const { invalidate, camera, size, gl } = useThree();
  
  const models = useStore((state) => state.models);
  const isGridVisible = useStore((state) => state.isGridVisible);
  const ppi = useStore((state) => state.ppi);
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);
  
  const ppm = useMemo(() => ppi / 25.4, [ppi]);

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

  const check1to1Scale = useCallback(() => {
    if (document.visibilityState !== 'visible') return;

    const now = performance.now();
    if (now - lastCheckTime.current < 100) return;
    lastCheckTime.current = now;

    const state = useStore.getState();
    
    if (state.isCalibrationModalOpen) {
        if (state.is1to1Mode) state.set1to1Mode(false);
        return;
    }
    
    // Use local ref
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

  // 2. YOUR FIX: Force wake-up on DOM interaction
  // This acts as a safety net for the 'demand' frameloop
  useEffect(() => {
    const handleInteraction = () => invalidate();
    
    const el = gl.domElement;
    el.addEventListener('pointerdown', handleInteraction);
    el.addEventListener('wheel', handleInteraction);
    // Added touch events for mobile reliability
    el.addEventListener('touchstart', handleInteraction);
    el.addEventListener('touchmove', handleInteraction);
    
    return () => {
        el.removeEventListener('pointerdown', handleInteraction);
        el.removeEventListener('wheel', handleInteraction);
        el.removeEventListener('touchstart', handleInteraction);
        el.removeEventListener('touchmove', handleInteraction);
    };
  }, [gl, invalidate]);

  // 3. CRITICAL FIX: Stable Callback Ref
  // This prevents the controls from detaching/re-attaching on every render
  const handleControlsRef = useCallback((node: CameraControls | null) => {
    controlsRef.current = node;
    
    if (node) {
        // --- SETUP CONFIG ---
        node.dollyToCursor = true;
        node.minZoom = 0.01;
        node.maxZoom = 5000;
        node.mouseButtons.middle = ACTION.TRUCK as any;
        node.mouseButtons.right = ACTION.TRUCK as any;
        node.smoothTime = 0.25;
        node.draggingSmoothTime = 0.25;
        
        // --- PATCHING ---
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
                if (updated) invalidate();
                return updated;
            };
        }

        onMountControls(node);
    }
  }, [onMountControls, invalidate]); // Only recreate if these change
  
  return (
    <>
      <CameraControls 
        ref={handleControlsRef} // <--- Using the stable ref here
        makeDefault 
        onChange={() => {
            invalidate();
            check1to1Scale(); 
        }}
      />
      
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
});

export const ViewerScene: React.FC<{ 
  controlsRef: React.MutableRefObject<CameraControls | null> 
}> = ({ controlsRef }) => {
  const selectModel = useStore((state) => state.selectModel);

  // Use useCallback here too so we don't force SceneContent to update unnecessarily
  const handleMountControls = useCallback((ctrl: CameraControls) => {
    controlsRef.current = ctrl;
  }, [controlsRef]);

  return (
    <div className="w-full h-full relative bg-[#000000]">
      <Canvas
        dpr={[1, 2]}
        orthographic
        frameloop="demand"
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
        onPointerMissed={(e) => { 
            if (e.type === 'click') selectModel(null); 
        }}
      >
        <SceneContent onMountControls={handleMountControls} />
      </Canvas>
    </div>
  );
};
