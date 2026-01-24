import React, { useMemo, useState, useEffect } from 'react';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { LoadedModel } from '../types';

// Augment React's JSX namespace directly to fix R3F type errors
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

// Internal component to handle scene processing and bounds reporting
const SceneProcessor: React.FC<{ 
    scene: THREE.Object3D | THREE.Group | THREE.Mesh; 
    modelId: string; 
    color: string;
    isNativeYUp: boolean;
}> = ({ scene, modelId, color, isNativeYUp }) => {
    const { updateModelDimensions } = useStore();

    useEffect(() => {
        // --- DRIFT FIX ---
        // Immediately reset transforms to prevent cumulative drift on re-renders.
        // Without this, applying an offset to an already offset mesh causes it to fly away.
        scene.position.set(0, 0, 0);
        scene.rotation.set(0, 0, 0);
        scene.scale.set(1, 1, 1);
        scene.updateMatrixWorld(true);

        // 1. Apply Color & Material
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                // Shadows removed
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                
                // Ensure normals exist for correct lighting
                if (mesh.geometry && !mesh.geometry.attributes.normal) {
                    mesh.geometry.computeVertexNormals();
                }

                // Material Tuning
                mesh.material = new THREE.MeshStandardMaterial({ 
                    color: color, 
                    roughness: 0.5, 
                    metalness: 0.1,
                    envMapIntensity: 1.0 
                });
            }
        });

        // 2. Fix Orientation
        if (isNativeYUp) {
            scene.rotation.x = Math.PI / 2;
        }

        // 3. Update Matrix
        scene.updateMatrixWorld(true);

        // 4. Calculate Bounding Box
        const box = new THREE.Box3().setFromObject(scene);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);

        // 5. FIX: Convert World Center to Local Center
        // We want to know where the center is relative to the PARENT group, not the world.
        // This ensures that even if the mesh has some internal offsets or if parents are moved,
        // we calculate the correct counter-offset.
        const localCenter = scene.worldToLocal(center.clone());

        // 6. Apply Center Offset (Use Local Center!)
        scene.position.x = -localCenter.x;
        scene.position.y = -localCenter.y;
        
        // For Z, we want the bottom of the box to be at 0.
        // localCenter.z corresponds to the geometric center.
        // We shift by -localCenter.z to center it on Z, then add half height.
        scene.position.z = -localCenter.z + (size.z / 2); 

        // 7. Report Dimensions to Store
        updateModelDimensions(modelId, size.x, size.y, size.z);

    }, [scene, color, isNativeYUp, modelId, updateModelDimensions]);

    return <primitive object={scene} />;
};

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

const InnerModel: React.FC<{ modelData: LoadedModel }> = ({ modelData }) => {
  const extension = useMemo(() => modelData.file.name.split('.').pop()?.toLowerCase(), [modelData.file.name]);

  return (
     <group>
        {extension === 'obj' && <ObjLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
        {extension === 'stl' && <StlLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
        {extension === '3mf' && <ThreeMFLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
     </group>
  );
};

// --- Main Wrapper ---

export const ModelWrapper: React.FC<ModelWrapperProps> = ({ modelData, index }) => {
  // OPTIMIZATION: Use selective subscriptions to prevent re-renders of other models
  // when one model moves.
  const isSelected = useStore((state) => state.selectedModelId === modelData.id);
  
  const position = useStore((state) => state.modelPositions[modelData.id] || { x: 0, y: 0, z: 0 });
  const rotation = useStore((state) => state.modelRotations[modelData.id] || { x: 0, y: 0, z: 0 });
  const scale = useStore((state) => state.modelScales[modelData.id] || { x: 1, y: 1, z: 1 });
  
  // FIX: FLASH PREVENT
  // We check if dimensions have been calculated for this model.
  // If not, we hide the group. This prevents the model from flashing at 0,0,0 
  // before the layout engine positions it.
  const dimensions = useStore((state) => state.modelDimensions[modelData.id]);
  const isReady = !!dimensions;

  const gizmoMode = useStore((state) => state.gizmoMode);
  const rotationSnap = useStore((state) => state.rotationSnap);
  const selectModel = useStore((state) => state.selectModel);
  const updateModelTransform = useStore((state) => state.updateModelTransform);

  const [group, setGroup] = useState<THREE.Group | null>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); 
    selectModel(modelData.id);
  };

  return (
    <>
      {isSelected && group && isReady && (
        <TransformControls 
          object={group} 
          mode={gizmoMode} 
          enabled={true}
          rotationSnap={rotationSnap} 
          size={0.8}
          space="local"
          // FIX: Changed from onObjectChange to onMouseUp.
          // This prevents the "infinite loop" error by only updating
          // the global store when the drag action is complete.
          onMouseUp={() => {
             if (!group) return;
             updateModelTransform(modelData.id, {
                 position: { x: group.position.x, y: group.position.y, z: group.position.z },
                 rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
                 scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z }
             });
          }}
        />
      )}
      <group 
        ref={setGroup}
        position={[position.x, position.y, position.z]}
        rotation={[rotation.x, rotation.y, rotation.z]}
        scale={[scale.x, scale.y, scale.z]}
        onClick={handleClick}
        onPointerMissed={() => {}}
        visible={isReady && modelData.visible}
      >
         <InnerModel modelData={modelData} />
      </group>
    </>
  );
};