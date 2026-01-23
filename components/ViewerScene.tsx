import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { ModelWrapper } from './Model';

// Augment React's JSX namespace directly to fix R3F type errors
declare module 'react' {
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

const SceneContent: React.FC<{ 
  onMountControls: (controls: CameraControls) => void 
}> = ({ onMountControls }) => {
  const controlsRef = useRef<CameraControls>(null);
  
  const models = useStore((state) => state.models);
  // OPTIMIZATION: Removed subscription to modelPositions to prevent re-rendering the whole scene on drag.
  const isGridVisible = useStore((state) => state.isGridVisible);
  const ppi = useStore((state) => state.ppi);
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);
  
  // Spotlight target object
  const lightTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    return obj;
  }, []);

  // Dynamic Centroid Calculation (Transient)
  // We read the store directly inside the frame loop to update the light 
  // without triggering React renders for the Scene component.
  useFrame(() => {
    const state = useStore.getState();
    const positions = state.modelPositions;
    const currentModels = state.models;

    let cx = 0, cy = 0;
    let count = 0;

    currentModels.forEach(m => {
        const pos = positions[m.id];
        if (pos) {
            cx += pos.x;
            cy += pos.y;
            count++;
        }
    });

    if (count > 0) {
        cx /= count;
        cy /= count;
    }

    // Smoothly interpolate light target for a cinematic feel
    lightTarget.position.lerp(new THREE.Vector3(cx, cy, 0), 0.1);
    lightTarget.updateMatrixWorld();
  });
  
  // Optimization: Cache PPM (Pixels Per Millimeter) calculation
  const ppm = useMemo(() => ppi / 25.4, [ppi]);

  // Optimization: Stabilize function reference to prevent re-creation on every render
  const check1to1Scale = useCallback(() => {
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
    
    if (controls.camera.type === 'PerspectiveCamera') {
        const cam = controls.camera as THREE.PerspectiveCamera;
        if (cam.fov) {
            // Recalculating FOV math here is cheap, window.innerHeight is fast access
            const fovRad = THREE.MathUtils.degToRad(cam.fov);
            // Use cached ppm
            const idealDist = (window.innerHeight / ppm) / (2 * Math.tan(fovRad / 2));
            if (idealDist > 0) isMatch = (Math.abs(controls.distance - idealDist) / idealDist) < tolerance;
        }
    } else if (controls.camera.type === 'OrthographicCamera') {
        const cam = controls.camera as THREE.OrthographicCamera;
        if (cam.zoom) {
            isMatch = Math.abs(cam.zoom - ppm) / ppm < tolerance;
        }
    }
    
    // Only update store if value actually changes
    if (state.is1to1Mode !== isMatch) state.set1to1Mode(isMatch);
  }, [ppm]); // Only re-create if calibration (PPI) changes

  // Trigger check when PPI or Modal state changes specifically
  useEffect(() => { check1to1Scale(); }, [check1to1Scale, ppi, isCalibrationModalOpen]);
  
  return (
    <>
      <CameraControls 
        ref={(node) => {
          controlsRef.current = node;
          if (node) {
             node.mouseButtons.middle = ACTION.TRUCK as any;
             node.mouseButtons.right = ACTION.TRUCK as any;
             onMountControls(node);
          }
        }}
        makeDefault 
        minZoom={0.01}
        maxZoom={5000}
        dollyToCursor={true} 
        onChange={check1to1Scale}
      />
      
      <Environment preset="city" blur={0.8} />

      {/* Lighting Setup */}
      {/* Ambient light for base visibility */}
      <ambientLight intensity={0.7} />
      
      {/* Key Light - Sun position from top-right-front */}
      <directionalLight 
        position={[100, 200, 300]} 
        intensity={2.0} 
        color="#ffffff" 
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.001} 
        shadow-normalBias={0.02} 
      />

      {/* Dynamic Spotlight - Tracks the models */}
      <primitive object={lightTarget} />
      <spotLight
        position={[0, 0, 500]} 
        ref={(light) => {
             // Optional: Attach light logic if needed, but the target handles direction.
        }}
        target={lightTarget}
        angle={0.6}
        penumbra={0.5}
        intensity={3.0}
        castShadow
        color="#ffffff"
        distance={2000} 
        decay={0} 
      />
      
      {/* Fill Light - Back side */}
      <rectAreaLight 
        width={40} 
        height={40} 
        color="#ffffff" 
        intensity={1.0} 
        position={[0, 50, 0]} 
        lookAt={() => new THREE.Vector3(0,0,0)} 
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
        <React.Suspense key={model.id} fallback={null}>
          <ModelWrapper modelData={model} index={index} />
        </React.Suspense>
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
        shadows
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
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2, // Slightly increased exposure
            // logarithmicDepthBuffer: true // Disabled for performance and Z-fighting reduction
        }}
        onPointerMissed={(e) => { if (e.type === 'click') selectModel(null); }}
      >
        <SceneContent onMountControls={(ctrl) => { controlsRef.current = ctrl; }} />
      </Canvas>
    </div>
  );
};