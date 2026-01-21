
import React, { useMemo, useState, useEffect } from 'react';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { LoadedModel } from '../types';

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
        // 1. Apply Color & Material
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Ensure normals exist for correct lighting
                if (mesh.geometry && !mesh.geometry.attributes.normal) {
                    mesh.geometry.computeVertexNormals();
                }

                // Material Tuning:
                // Increased envMapIntensity to 1.0 to fix "black model" issues
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
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // 5. Center Internally (Geometry Center -> Local 0,0,0)
        // Z-UP: Drop to floor
        const bottomZ = box.min.z;
        scene.position.x = -center.x;
        scene.position.y = -center.y;
        scene.position.z = -bottomZ; 

        // 6. Report Dimensions to Store
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

const createLabelTexture = (text: string, bgColor: string, rotation: number = 0) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Fill background with model color
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 512, 512);
        
        // Inner Border
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 16;
        ctx.strokeRect(16, 16, 480, 480);
        
        // Rotate Context
        ctx.translate(256, 256);
        ctx.rotate(rotation);
        
        // Text
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 280px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Slight vertical offset for visual centering of caps
        ctx.fillText(text, 0, 20); 
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
};

const ProceduralCube: React.FC<{ color: string; id: string }> = ({ color, id }) => {
  const { updateModelDimensions } = useStore();

  useEffect(() => {
    // 20mm Cube
    updateModelDimensions(id, 20, 20, 20);
  }, [id, updateModelDimensions]);

  const materials = useMemo(() => {
    const baseMat = new THREE.MeshStandardMaterial({ 
        color, 
        roughness: 0.5, 
        metalness: 0.1,
        envMapIntensity: 1.0
    });
    
    // Helper to generate textured material
    const labelMat = (label: string, rotation: number) => {
        return new THREE.MeshStandardMaterial({
            map: createLabelTexture(label, color, rotation),
            roughness: 0.5,
            metalness: 0.1,
            envMapIntensity: 1.0
        });
    };

    // BoxGeometry Face Order: +x, -x, +y, -y, +z, -z
    // We adjust rotations so text "stands up" relative to Z-up world
    return [
        labelMat('X', -Math.PI / 2), // +x (Right)
        baseMat,                     // -x
        labelMat('Y', Math.PI),      // +y (Back)
        baseMat,                     // -y
        labelMat('Z', 0),            // +z (Top)
        baseMat                      // -z
    ];
  }, [color]);

  return (
    <group position={[0, 0, 10]}>
        <mesh 
            castShadow 
            receiveShadow 
            material={materials}
        >
            <boxGeometry args={[20, 20, 20]} />
        </mesh>
    </group>
  );
};

const InnerModel: React.FC<{ modelData: LoadedModel }> = ({ modelData }) => {
  const extension = useMemo(() => modelData.file.name.split('.').pop()?.toLowerCase(), [modelData.file.name]);

  return (
     <group>
        {extension === 'obj' && <ObjLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
        {extension === 'stl' && <StlLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
        {extension === '3mf' && <ThreeMFLoaded url={modelData.url} color={modelData.color} id={modelData.id} />}
        {extension === 'cube' && <ProceduralCube color={modelData.color} id={modelData.id} />}
     </group>
  );
};

// --- Main Wrapper ---

export const ModelWrapper: React.FC<ModelWrapperProps> = ({ modelData, index }) => {
  const { 
    gizmoMode, 
    rotationSnap, 
    selectedModelId, 
    selectModel, 
    modelPositions, 
    modelRotations, 
    modelScales,
    updateModelTransform 
  } = useStore();
  
  const [group, setGroup] = useState<THREE.Group | null>(null);

  const isSelected = selectedModelId === modelData.id;
  
  // Read transform from store
  const position = modelPositions[modelData.id] || { x: 0, y: 0, z: 0 };
  const rotation = modelRotations[modelData.id] || { x: 0, y: 0, z: 0 };
  const scale = modelScales[modelData.id] || { x: 1, y: 1, z: 1 };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); 
    selectModel(modelData.id);
  };

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
          onObjectChange={(e) => {
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
      >
         <InnerModel modelData={modelData} />
      </group>
    </>
  );
};
