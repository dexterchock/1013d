import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';
import { TransformControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { LoadedModel } from '../types';

// Fix R3F type errors
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
// INTERNAL COMPONENT: SceneProcessor
// ------------------------------------------------------------------
const SceneProcessor: React.FC<{ 
    scene: THREE.Object3D | THREE.Group | THREE.Mesh; 
    modelId: string; 
    color: string;
    isNativeYUp: boolean;
}> = React.memo(({ scene, modelId, color, isNativeYUp }) => {
    const updateModelDimensions = useStore((state) => state.updateModelDimensions);
    const processedRef = useRef(false);

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

    // Safety Gate: Prevent Infinite Load Loop
    useEffect(() => {
        const currentDims = useStore.getState().modelDimensions?.[modelId];
        if (currentDims && processedRef.current) return;

        if (isNativeYUp) {
            scene.rotation.x = Math.PI / 2;
        }

        scene.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const bottomZ = box.min.z;
        scene.position.x = -center.x;
        scene.position.y = -center.y;
        scene.position.z = -bottomZ; 

        updateModelDimensions(modelId, size.x, size.y, size.z);
        processedRef.current = true;
    }, [scene, modelId, isNativeYUp, updateModelDimensions]);

    return <primitive object={scene} />;
});

// ------------------------------------------------------------------
// INTERNAL COMPONENT: ProceduralCube
// ------------------------------------------------------------------
const ProceduralCube: React.FC<{ modelId: string; color: string }> = ({ modelId, color }) => {
  const updateModelDimensions = useStore((state) => state.updateModelDimensions);
  
  useEffect(() => {
    const currentDims = useStore.getState().modelDimensions?.[modelId];
    if (currentDims) return;
    updateModelDimensions(modelId, 20, 20, 20);
  }, [modelId, updateModelDimensions]);

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
// LOADERS
// ------------------------------------------------------------------
const ObjLoaded: React.FC<{ url: string; color: string; id: string }> = ({ url, color, id }) => {
  const obj = useLoader(OBJLoader, url);
  const scene = useMemo(() => obj.clone(), [obj]);
  return <SceneProcessor scene={scene} modelId={id} color={color} isNativeYUp={false} />;
};

const StlLoaded: React.FC<{ url: string; color: string; id: string }> = ({ url, color, id }) => {
  const geom = useLoader(STLLoader, url);
  const mesh = useMemo(() => new THREE.Mesh(geom), [geom]);
  return <SceneProcessor scene={mesh} modelId={id} color={color} isNativeYUp={false} />;
};

const ThreeMFLoaded: React.FC<{ url: string; color: string; id: string }> = ({ url, color, id }) => {
  const object = useLoader(ThreeMFLoader, url);
  const scene = useMemo(() => object.clone(), [object]);
  return <SceneProcessor scene={scene} modelId={id} color={color} isNativeYUp={false} />;
};

const InnerModel: React.FC<{ modelData: LoadedModel }> = React.memo(({ modelData }) => {
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
// MAIN WRAPPER (CRASH FIX HERE)
// ------------------------------------------------------------------
export const ModelWrapper: React.FC<ModelWrapperProps> = ({ modelData }) => {
  // 1. Stable Action Selectors (These never cause re-renders)
  const gizmoMode = useStore(state => state.gizmoMode);
  const rotationSnap = useStore(state => state.rotationSnap);
  const selectedModelId = useStore(state => state.selectedModelId);
  const selectModel = useStore(state => state.selectModel);
  const updateModelTransform = useStore(state => state.updateModelTransform);
  
  // 2. Initial State ONLY. We DO NOT subscribe to these hooks for updates.
  // This prevents the component from re-rendering when the model moves.
  const [initialPos] = useState(() => useStore.getState().modelPositions[modelData.id] || { x: 0, y: 0, z: 0 });
  const [initialRot] = useState(() => useStore.getState().modelRotations[modelData.id] || { x: 0, y: 0, z: 0 });
  const [initialScale] = useState(() => useStore.getState().modelScales[modelData.id] || { x: 1, y: 1, z: 1 });

  const [group, setGroup] = useState<THREE.Group | null>(null);
  const draggingRef = useRef(false);
  const groupRef = useRef<THREE.Group | null>(null);

  const isSelected = selectedModelId === modelData.id;

  // 3. Manual Subscription (Transient Updates)
  // This updates the 3D object directly without waking up React
  useEffect(() => {
      // Connect to the store
      const unsub = useStore.subscribe((state) => {
          // 🛑 CRITICAL: If we are dragging, IGNORE the store update.
          // This breaks the infinite loop.
          if (draggingRef.current || !groupRef.current) return;

          const newPos = state.modelPositions[modelData.id];
          const newRot = state.modelRotations[modelData.id];
          const newScale = state.modelScales[modelData.id];

          // Mutate the object directly
          if (newPos) groupRef.current.position.set(newPos.x, newPos.y, newPos.z);
          if (newRot) groupRef.current.rotation.set(newRot.x, newRot.y, newRot.z);
          if (newScale) groupRef.current.scale.set(newScale.x, newScale.y, newScale.z);
      });
      return () => unsub();
  }, [modelData.id]);

  // Capture the ref safely
  const handleGroupRef = useCallback((node: THREE.Group) => {
      setGroup(node);
      groupRef.current = node;
  }, []);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); 
    selectModel(modelData.id);
  };

  const handleDragStart = useCallback(() => {
     draggingRef.current = true; 
  }, []);

  const handleDragEnd = useCallback(() => {
     draggingRef.current = false;
  }, []);

  const handleObjectChange = useCallback((e: any) => {
     // Only update store if we are actually dragging
     if (!draggingRef.current || !groupRef.current) return;

     const g = groupRef.current;
     updateModelTransform(modelData.id, {
         position: { x: g.position.x, y: g.position.y, z: g.position.z },
         rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
         scale: { x: g.scale.x, y: g.scale.y, z: g.scale.z }
     });
  }, [modelData.id, updateModelTransform]);

  return (
    <>
      {isSelected && group && (
        <TransformControls 
          object={group} 
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
        ref={handleGroupRef}
        // Set initial values, but DO NOT update these props on re-renders.
        // The useEffect above handles all updates manually.
        position={[initialPos.x, initialPos.y, initialPos.z]}
        rotation={[initialRot.x, initialRot.y, initialRot.z]}
        scale={[initialScale.x, initialScale.y, initialScale.z]}
        onClick={handleClick}
        onPointerMissed={() => {}}
      >
         <InnerModel modelData={modelData} />
      </group>
    </>
  );
};
