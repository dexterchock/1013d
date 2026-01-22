import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';
import { TransformControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { LoadedModel } from '../types';

// ------------------------------------------------------------------
// TYPE FIXES
// ------------------------------------------------------------------
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      primitive: any;
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
    }
  }
}

interface ModelWrapperProps {
  modelData: LoadedModel;
  index: number;
}

// ------------------------------------------------------------------
// SCENE PROCESSOR (Geometry & Materials)
// Optimized to run ONCE and never look back.
// ------------------------------------------------------------------
const SceneProcessor: React.FC<{ 
    scene: THREE.Object3D | THREE.Group | THREE.Mesh; 
    modelId: string; 
    color: string;
    isNativeYUp: boolean;
}> = React.memo(({ scene, modelId, color, isNativeYUp }) => {
    // ⚡️ PERFORMANCE: We do NOT hook into the store here. 
    // We access the setter via a closure or getState to prevent re-renders.
    const processedRef = useRef(false);

    // 1. Material Application
    useEffect(() => {
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (mesh.geometry && !mesh.geometry.attributes.normal) {
                    mesh.geometry.computeVertexNormals();
                }
                mesh.material = new THREE.MeshStandardMaterial({ 
                    color: color, 
                    roughness: 0.5, 
                    metalness: 0.1,
                    envMapIntensity: 1.0 
                });
            }
        });
    }, [scene, color]);

    // 2. Geometry & Dimension Calculation
    useEffect(() => {
        // ⚡️ CHECK: Direct store access to prevent loop
        const state = useStore.getState();
        if (state.modelDimensions?.[modelId] && processedRef.current) return;

        if (isNativeYUp) {
            scene.rotation.x = Math.PI / 2;
        }

        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Centering
        const bottomZ = box.min.z;
        scene.position.x = -center.x;
        scene.position.y = -center.y;
        scene.position.z = -bottomZ; 

        // ⚡️ UPDATE: Call setter directly
        state.updateModelDimensions(modelId, size.x, size.y, size.z);
        processedRef.current = true;

    }, [scene, modelId, isNativeYUp]); // Minimized dependencies

    return <primitive object={scene} />;
});

// ------------------------------------------------------------------
// PROCEDURAL CUBE
// ------------------------------------------------------------------
const ProceduralCube: React.FC<{ modelId: string; color: string }> = ({ modelId, color }) => {
  useEffect(() => {
    const state = useStore.getState();
    if (!state.modelDimensions?.[modelId]) {
       state.updateModelDimensions(modelId, 20, 20, 20);
    }
  }, [modelId]);

  const textProps = {
    fontSize: 10,
    color: "white",
    anchorX: "center" as const,
    anchorY: "middle" as const,
    font: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
  };

  return (
    <group position={[0, 0, 10]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[20, 20, 20]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} envMapIntensity={1.0} />
      </mesh>
      <Text position={[0, 0, 10.05]} rotation={[0, 0, 0]} {...textProps}>Z</Text>
      <Text position={[10.05, 0, 0]} rotation={[0, Math.PI / 2, Math.PI / 2]} {...textProps}>X</Text>
      <Text position={[0, 10.05, 0]} rotation={[Math.PI / 2, Math.PI, 0]} {...textProps}>Y</Text>
    </group>
  );
};

// ------------------------------------------------------------------
// LOADERS (Pure Components)
// ------------------------------------------------------------------
const ObjLoaded = React.memo(({ url, color, id }: { url: string; color: string; id: string }) => {
  const obj = useLoader(OBJLoader, url);
  const scene = useMemo(() => obj.clone(), [obj]);
  return <SceneProcessor scene={scene} modelId={id} color={color} isNativeYUp={false} />;
});

const StlLoaded = React.memo(({ url, color, id }: { url: string; color: string; id: string }) => {
  const geom = useLoader(STLLoader, url);
  const mesh = useMemo(() => new THREE.Mesh(geom), [geom]);
  return <SceneProcessor scene={mesh} modelId={id} color={color} isNativeYUp={false} />;
});

const ThreeMFLoaded = React.memo(({ url, color, id }: { url: string; color: string; id: string }) => {
  const object = useLoader(ThreeMFLoader, url);
  const scene = useMemo(() => object.clone(), [object]);
  return <SceneProcessor scene={scene} modelId={id} color={color} isNativeYUp={false} />;
});

const InnerModel = React.memo(({ modelData }: { modelData: LoadedModel }) => {
  const extension = useMemo(() => modelData.file.name.split('.').pop()?.toLowerCase(), [modelData.file.name]);
  
  return (
     <group>
        {extension === 'cube' && <ProceduralCube modelId={modelData.id} color={modelData.color} />}
        {extension === 'obj' && <ObjLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
        {extension === 'stl' && <StlLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
        {extension === '3mf' && <ThreeMFLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
     </group>
  );
}, (prev, next) => prev.modelData.id === next.modelData.id && prev.modelData.color === next.modelData.color);

// ------------------------------------------------------------------
// MAIN WRAPPER (THE FIX)
// ------------------------------------------------------------------
export const ModelWrapper: React.FC<ModelWrapperProps> = ({ modelData }) => {
  // ⚡️ 1. GLOBAL STATE: Only listen to "Mode" changes, NOT position changes.
  const gizmoMode = useStore(state => state.gizmoMode);
  const rotationSnap = useStore(state => state.rotationSnap);
  const selectedModelId = useStore(state => state.selectedModelId);
  const selectModel = useStore(state => state.selectModel);

  // ⚡️ 2. DIRECT ACCESS: We do not bind position/rotation/scale to React state.
  // This prevents the component from re-rendering when the model moves.
  const groupRef = useRef<THREE.Group>(null);
  const draggingRef = useRef(false);
  const [isSelected, setIsSelected] = useState(false);

  // Sync selection state locally to avoid full re-renders
  useEffect(() => {
    setIsSelected(selectedModelId === modelData.id);
  }, [selectedModelId, modelData.id]);

  // ⚡️ 3. MANUAL SUBSCRIPTION: Bridge Zustand -> ThreeJS directly
  useEffect(() => {
    // Initial Load
    const state = useStore.getState();
    const initPos = state.modelPositions[modelData.id];
    const initRot = state.modelRotations[modelData.id];
    const initScale = state.modelScales[modelData.id];

    if (groupRef.current) {
        if(initPos) groupRef.current.position.set(initPos.x, initPos.y, initPos.z);
        if(initRot) groupRef.current.rotation.set(initRot.x, initRot.y, initRot.z);
        if(initScale) groupRef.current.scale.set(initScale.x, initScale.y, initScale.z);
    }

    // Subscribe to changes
    const unsubscribe = useStore.subscribe((state) => {
        // If WE are dragging, ignore updates (prevents fighting/loops)
        if (draggingRef.current || !groupRef.current) return;
        
        // Check if OUR data changed
        const newPos = state.modelPositions[modelData.id];
        const newRot = state.modelRotations[modelData.id];
        const newScale = state.modelScales[modelData.id];

        if (newPos) groupRef.current.position.set(newPos.x, newPos.y, newPos.z);
        if (newRot) groupRef.current.rotation.set(newRot.x, newRot.y, newRot.z);
        if (newScale) groupRef.current.scale.set(newScale.x, newScale.y, newScale.z);
    });

    return () => unsubscribe();
  }, [modelData.id]); // Run only on mount

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); 
    selectModel(modelData.id);
  };

  const handleDragStart = () => { draggingRef.current = true; };
  const handleDragEnd = () => { draggingRef.current = false; };

  const handleObjectChange = (e: any) => {
     if (!groupRef.current) return;
     const group = groupRef.current;
     
     // Throttle or direct update to store
     // We use getState() to access the action without hooking
     useStore.getState().updateModelTransform(modelData.id, {
         position: { x: group.position.x, y: group.position.y, z: group.position.z },
         rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
         scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z }
     });
  };

  return (
    <>
      {isSelected && groupRef.current && (
        <TransformControls 
          object={groupRef.current} 
          mode={gizmoMode} 
          enabled={true}
          rotationSnap={rotationSnap} 
          size={0.8}
          space="local"
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          onObjectChange={handleObjectChange}
        />
      )}
      <group 
        ref={groupRef}
        onClick={handleClick}
        onPointerMissed={() => {}}
      >
         {/* NOTE: We do NOT pass position/rotation/scale props here.
             They are handled by the Subscription Effect above. 
             This keeps React rendering completely separate from Scene Graph updates.
         */}
         <InnerModel modelData={modelData} />
      </group>
    </>
  );
};
