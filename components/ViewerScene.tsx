import React, { useRef, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, Environment, Grid, Lightformer, Text } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import {
  MathUtils,
  PerspectiveCamera,
  OrthographicCamera,
  ACESFilmicToneMapping,
} from 'three';
import { useStore } from '../store';
import { ErrorBoundary } from './ErrorBoundary';

const ModelWrapper = React.lazy(() =>
  import('./Model').then((module) => ({ default: module.ModelWrapper }))
);

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
  onMountControls: (controls: CameraControls) => void;
}> = React.memo(({ onMountControls }) => {
  const controlsRef = useRef<CameraControls | null>(null);
  const lastCheckTimeRef = useRef(0);
  const trailingCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const evaluate1to1Scale = useCallback(() => {
    if (document.visibilityState !== 'visible') return;

    const state = useStore.getState();

    if (state.isCalibrationModalOpen) {
      if (state.is1to1Mode) state.set1to1Mode(false);
      return;
    }

    const controls = controlsRef.current;
    if (!controls) return;

    const tolerance = 0.015;
    let isMatch = false;

    if (camera.type === 'PerspectiveCamera') {
      const idealDist = size.height * perspectiveFactor;
      if (idealDist > 0) {
        isMatch = Math.abs(controls.distance - idealDist) / idealDist < tolerance;
      }
    } else if (camera.type === 'OrthographicCamera') {
      const cam = camera as OrthographicCamera;
      if (cam.zoom) {
        isMatch = Math.abs(cam.zoom - ppm) / ppm < tolerance;
      }
    }

    if (state.is1to1Mode !== isMatch) {
      state.set1to1Mode(isMatch);
    }
  }, [ppm, perspectiveFactor, size.height, camera]);

  const schedule1to1Check = useCallback(
    (immediate = false) => {
      if (trailingCheckTimerRef.current) {
        clearTimeout(trailingCheckTimerRef.current);
        trailingCheckTimerRef.current = null;
      }

      if (immediate) {
        lastCheckTimeRef.current = performance.now();
        evaluate1to1Scale();
        return;
      }

      const now = performance.now();
      if (now - lastCheckTimeRef.current >= 100) {
        lastCheckTimeRef.current = now;
        evaluate1to1Scale();
      } else {
        trailingCheckTimerRef.current = setTimeout(() => {
          trailingCheckTimerRef.current = null;
          lastCheckTimeRef.current = performance.now();
          evaluate1to1Scale();
        }, 110);
      }
    },
    [evaluate1to1Scale]
  );

  useEffect(() => {
    schedule1to1Check(true);
  }, [schedule1to1Check, ppi, isCalibrationModalOpen]);

  useEffect(() => {
    return () => {
      if (trailingCheckTimerRef.current) {
        clearTimeout(trailingCheckTimerRef.current);
      }
    };
  }, []);

  // Ensure demand frameloop wakes immediately on pointer/wheel/touch input.
  useEffect(() => {
    const handleInteraction = () => invalidate();

    const el = gl.domElement;
    el.addEventListener('pointerdown', handleInteraction);
    el.addEventListener('wheel', handleInteraction, { passive: true });
    el.addEventListener('touchstart', handleInteraction, { passive: true });
    el.addEventListener('touchmove', handleInteraction, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', handleInteraction);
      el.removeEventListener('wheel', handleInteraction);
      el.removeEventListener('touchstart', handleInteraction);
      el.removeEventListener('touchmove', handleInteraction);
    };
  }, [gl, invalidate]);

  // Trigger a final 1:1 check when camera damping settles.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleRest = () => {
      schedule1to1Check(true);
    };

    controls.addEventListener('rest', handleRest);
    return () => {
      controls.removeEventListener('rest', handleRest);
    };
  }, [schedule1to1Check]);

  const handleControlsRef = useCallback(
    (node: CameraControls | null) => {
      controlsRef.current = node;

      if (node) {
        node.dollyToCursor = true;
        node.minZoom = 0.01;
        node.maxZoom = 5000;
        node.mouseButtons.middle = CameraControlsImpl.ACTION.TRUCK;
        node.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
        node.smoothTime = 0.25;
        node.draggingSmoothTime = 0.25;

        // In frameloop="demand", waking from idle produces a large first-frame delta.
        // Clamping delta avoids instant 1-frame jumps on programmatic camera transitions.
        if (!(node as unknown as { __deltaClamped?: boolean }).__deltaClamped) {
          (node as unknown as { __deltaClamped?: boolean }).__deltaClamped = true;
          const originalUpdate = node.update.bind(node);
          node.update = (delta: number) => {
            const safeDelta = Math.min(delta, 0.05);
            const updated = originalUpdate(safeDelta);
            if (updated) invalidate();
            return updated;
          };
        }

        onMountControls(node);
      }
    },
    [onMountControls, invalidate]
  );

  return (
    <>
      <CameraControls
        ref={handleControlsRef}
        makeDefault
        onChange={() => {
          invalidate();
          schedule1to1Check(false);
        }}
        onEnd={() => {
          schedule1to1Check(true);
        }}
      />

      {/* Zero-network procedural studio reflections (avoids external HDR download & redirect) */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={2}
          color="#ffffff"
          position={[0, -5, 10]}
          scale={[12, 12, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#dbeafe"
          position={[8, 6, 4]}
          scale={[8, 8, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#f8fafc"
          position={[-8, 4, 4]}
          scale={[8, 8, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="ring"
          intensity={0.8}
          color="#94a3b8"
          position={[0, 0, -8]}
          scale={10}
          target={[0, 0, 0]}
        />
      </Environment>
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

      {models.length > 0 &&
        models.map((model) => (
          <ErrorBoundary
            key={model.id}
            fallback={<ErrorFallback fileName={model.file.name} />}
            onError={(e) => console.warn(`Model failed to load: ${model.file.name}`, e)}
          >
            <Suspense fallback={null}>
              <ModelWrapper modelData={model} />
            </Suspense>
          </ErrorBoundary>
        ))}
    </>
  );
});

export const ViewerScene: React.FC<{
  controlsRef: React.MutableRefObject<CameraControls | null>;
}> = ({ controlsRef }) => {
  const selectModel = useStore((state) => state.selectModel);

  const handleMountControls = useCallback(
    (ctrl: CameraControls) => {
      controlsRef.current = ctrl;
    },
    [controlsRef]
  );

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
          far: 1000,
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
