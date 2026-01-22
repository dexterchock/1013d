import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';
import { TransformControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { LoadedModel } from '../types';

// Augment React's JSX namespace
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

// --- Internal Components ---

const SceneProcessor: React.FC<{ 
    scene: THREE.Object3D | THREE.Group | THREE.Mesh; 
    modelId: string; 
    color: string;
    isNativeYUp: boolean;
}> = React.memo(({ scene, modelId, color, isNativeYUp }) => {
    const updateModelDimensions = useStore((state) => state.updateModelDimensions);
    const processedRef = useRef(false);

    // 1. Material Effect (Runs on Color Change)
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

    // 2. Dimension Logic (Runs ONCE)
    useEffect(() => {
        // 🛑 HARD STOP: Check store directly to see if we already have dimensions.
        // This prevents the loop even if the component unmounts/remounts.
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

        // Update store only if necessary
        updateModelDimensions(modelId, size.x, size.y, size.z);
        processedRef.current = true;

    }, [scene, modelId, isNativeYUp, updateModelDimensions]);

    return <primitive object={scene} />;
});

const ProceduralCube: React.FC<{ modelId: string; color: string }> = ({ modelId, color }) => {
  const updateModelDimensions = useStore((state) => state.updateModelDimensions);
  
  useEffect(() => {
    // 🛑 HARD STOP for Cube as well
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

// --- Loaders (Memoized) ---

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

// Memoize InnerModel to prevent re-parsing geometry on position changes
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

// --- Main Wrapper ---

export const ModelWrapper: React.FC<ModelWrapperProps> = ({ modelData }) => {
  // Use Specific Selectors
  const gizmoMode = useStore(state => state.gizmoMode);
  const rotationSnap = useStore(state => state.rotationSnap);
  const selectedModelId = useStore(state => state.selectedModelId);
  const selectModel = useStore(state => state.selectModel);
  const updateModelTransform = useStore(state => state.updateModelTransform);
  
  // Transform Selectors
  const position = useStore(state => state.modelPositions[modelData.id] || { x: 0, y: 0, z: 0 });
  const rotation = useStore(state => state.modelRotations[modelData.id] || { x: 0, y: 0, z: 0 });
  const scale = useStore(state => state.modelScales[modelData.id] || { x: 1, y: 1, z: 1 });

  const [group, setGroup] = useState<THREE.Group | null>(null);
  
  // 🛑 The Fix: Use a ref to track dragging state synchronously
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const isSelected = selectedModelId === modelData.id;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); 
    selectModel(modelData.id);
  };

  const handleDragStart = useCallback(() => {
     draggingRef.current = true;
     setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
     draggingRef.current = false;
     setIsDragging(false);
  }, []);

  const handleObjectChange = useCallback(() => {
     // 🛑 GUARD: Only update store if WE are dragging. 
     // This prevents the loop where React update -> Controls Change -> React Update
     if (!draggingRef.current || !group) return;

     updateModelTransform(modelData.id, {
         position: { x: group.position.x, y: group.position.y, z: group.position.z },
         rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
         scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z }
     });
  }, [group, modelData.id, updateModelTransform]);

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
        ref={setGroup}
        // If dragging, we detach these props (pass undefined) so TransformControls takes over full control
        // If NOT dragging, we pass the store values so it snaps to the inputs
        position={isDragging ? undefined : [position.x, position.y, position.z]}
        rotation={isDragging ? undefined : [rotation.x, rotation.y, rotation.z]}
        scale={isDragging ? undefined : [scale.x, scale.y, scale.z]}
        onClick={handleClick}
        onPointerMissed={() => {}}
      >
         <InnerModel modelData={modelData} />
      </group>
    </>
  );
};
