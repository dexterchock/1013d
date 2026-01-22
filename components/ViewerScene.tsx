import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { ModelWrapper } from './Model';

// Augment JSX.IntrinsicElements to fix TypeScript errors if @react-three/fiber types are missing
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

const SceneContent: React.FC<{ 
  onMountControls: (controls: CameraControls) => void 
}> = ({ onMountControls }) => {
  const controlsRef = useRef<CameraControls>(null);
  
  const models = useStore((state) => state.models);
  const modelPositions = useStore((state) => state.modelPositions);
  const isGridVisible = useStore((state) => state.isGridVisible);
  const ppi = useStore((state) => state.ppi);
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);
  const set1to1Mode = useStore((state) => state.set1to1Mode);

  // --- Dynamic Centroid Calculation ---
  // Calculates the center point of all loaded models to focus the spotlight
  const centroid = useMemo(() => {
    if (models.length === 0) return { x: 0, y: 0, z: 0 };
    let sumX = 0, sumY = 0;
    let count = 0;
    
    models.forEach(m => {
        const pos = modelPositions[m.id] || {x:0, y:0, z:0};
        sumX += pos.x;
        sumY += pos.y;
        count++;
    });
    
    if (count === 0) return { x: 0, y: 0, z: 0 };
    return { x: sumX / count, y: sumY / count, z: 0 };
  }, [models, modelPositions]);

  // Spotlight target object
  const lightTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    return obj;
  }, []);

  // Update target position to track models
  useFrame(() => {
    lightTarget.position.set(centroid.x, centroid.y, 0);
    lightTarget.updateMatrixWorld();
  });
  
  const check1to1Scale = () => {
    if (useStore.getState().isCalibrationModalOpen) {
        if (useStore.getState().is1to1Mode) set1to1Mode(false);
        return;
    }
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    const ppm = ppi / 25.4;
    const tolerance = 0.015; 
    let isMatch = false;
    
    if (controls.camera.type === 'PerspectiveCamera') {
        const cam = controls.camera as THREE.PerspectiveCamera;
        if (cam.fov) {
            const fovRad = THREE.MathUtils.degToRad(cam.fov);
            const idealDist = (window.innerHeight / ppm) / (2 * Math.tan(fovRad / 2));
            if (idealDist > 0) isMatch = (Math.abs(controls.distance - idealDist) / idealDist) < tolerance;
        }
    } else if (controls.camera.type === 'OrthographicCamera') {
        const cam = controls.camera as THREE.OrthographicCamera;
        if (cam.zoom) {
            isMatch = Math.abs(cam.zoom - ppm) / ppm < tolerance;
        }
    }
    
    if (useStore.getState().is1to1Mode !== isMatch) set1to1Mode(isMatch);
  };

  useEffect(() => { check1to1Scale(); }, [ppi, isCalibrationModalOpen]);
  
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
        shadow-bias={-0.0005} 
        shadow-normalBias={0.05} 
      />

      {/* Dynamic Spotlight - Tracks the models */}
      <primitive object={lightTarget} />
      <spotLight
        position={[centroid.x, centroid.y, 500]} // High enough to clear large models
        target={lightTarget}
        angle={0.6}
        penumbra={0.5}
        intensity={3.0}
        castShadow
        color="#ffffff"
        distance={2000} // Increased range
        decay={0} // Reduced decay for consistent brightness
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
            near: -2000, 
            far: 2000 
        }}
        gl={{ 
            preserveDrawingBuffer: true, 
            antialias: true, 
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2, // Slightly increased exposure
            logarithmicDepthBuffer: true
        }}
        onPointerMissed={(e) => { if (e.type === 'click') selectModel(null); }}
      >
        <SceneContent onMountControls={(ctrl) => { controlsRef.current = ctrl; }} />
      </Canvas>
    </div>
  );
};