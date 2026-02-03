import React, { useMemo, useState, useEffect } from 'react';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { TransformControls, Bvh } from '@react-three/drei';
import { 
  MeshStandardMaterial, 
  FrontSide, 
  Object3D, 
  Group, 
  Mesh, 
  Box3, 
  Vector3,
  MathUtils,
  BufferGeometry
} from 'three';
import { useStore } from '../store';
import { LoadedModel } from '../types';

// Augment global JSX namespace to fix R3F type errors
declare global {
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
    scene: Object3D | Group | Mesh; 
    modelId: string; 
    color: string;
    isNativeYUp: boolean;
}> = ({ scene, modelId, color, isNativeYUp }) => {
    const { updateModelDimensions } = useStore();

    // PERFORMANCE: Shared Material
    // Create one material instance per model color instead of one per mesh.
    // OPTIMIZATION: Enforce FrontSide (Single-Side Rendering) to cull backfaces.
    const sharedMaterial = useMemo(() => new MeshStandardMaterial({ 
        color: color, 
        roughness: 0.5, 
        metalness: 0.1,
        envMapIntensity: 1.0,
        side: FrontSide 
    }), [color]);

    // OPTIMIZATION: Merge Geometries
    // Instead of traversing and rendering thousands of meshes, we merge them into one.
    // This dramatically reduces draw calls (CPU load).
    const mergedMesh = useMemo(() => {
        // 1. Reset input scene transforms to ensure world matrices are purely structural relative to root
        scene.position.set(0, 0, 0);
        scene.rotation.set(0, 0, 0);
        scene.scale.set(1, 1, 1);
        scene.updateMatrixWorld(true);

        const geometries: BufferGeometry[] = [];

        scene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh;
                if (mesh.geometry) {
                    // Clone geometry to safely mutate it (apply transform, delete attributes)
                    const geom = mesh.geometry.clone();
                    
                    // Strip unused attributes to ensure compatibility for merging.
                    // We only strictly need position and normal for this viewer.
                    // Mismatched attributes (e.g., some meshes having UVs and others not) causes merge failures.
                    if (geom.attributes.color) geom.deleteAttribute('color');
                    if (geom.attributes.uv) geom.deleteAttribute('uv');
                    if (geom.attributes.uv2) geom.deleteAttribute('uv2');
                    if (geom.attributes.tangent) geom.deleteAttribute('tangent');
                    
                    // Ensure normals exist for correct lighting
                    if (!geom.attributes.normal) geom.computeVertexNormals();
                    
                    // Bake the local transform (relative to the scene root) into the geometry vertices
                    geom.applyMatrix4(mesh.matrixWorld);
                    
                    geometries.push(geom);
                }
            }
        });

        if (geometries.length === 0) return null;

        // Merge all geometries into a single buffer
        const mergedGeometry = mergeGeometries(geometries, false);
        
        // Clean up the intermediate clones to free memory
        geometries.forEach(g => g.dispose());

        if (!mergedGeometry) return null;

        const mesh = new Mesh(mergedGeometry, sharedMaterial);

        // Shadows removed for performance
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        // 2. Fix Orientation (if needed)
        if (isNativeYUp) {
            mesh.rotation.x = Math.PI / 2;
        }
        mesh.updateMatrixWorld(true);

        // 3. Calculate Bounding Box on the final merged mesh
        const box = new Box3().setFromObject(mesh);
        const center = new Vector3();
        box.getCenter(center);
        const size = new Vector3();
        box.getSize(size);

        // 4. Center the mesh visual
        // We apply an offset to the mesh position so that its visual center is at (0,0,0) of its parent group.
        // We convert the calculated world center back to local space (though parent is likely identity).
        const localCenter = mesh.worldToLocal(center.clone());
        
        mesh.position.x = -localCenter.x;
        mesh.position.y = -localCenter.y;
        
        // For Z, we want the bottom of the bounding box to sit on the floor (Z=0)
        // localCenter.z is the geometric middle. 
        // -localCenter.z moves middle to 0.
        // + (size.z / 2) moves bottom to 0.
        mesh.position.z = -localCenter.z + (size.z / 2); 

        // Store dimensions in userData to retrieve in the effect below
        mesh.userData.dimensions = { x: size.x, y: size.y, z: size.z };

        return mesh;

    }, [scene, sharedMaterial, isNativeYUp]);

    // Report dimensions to the global store
    useEffect(() => {
        if (mergedMesh && mergedMesh.userData.dimensions) {
            const { x, y, z } = mergedMesh.userData.dimensions;
            updateModelDimensions(modelId, x, y, z);
        }
    }, [mergedMesh, modelId, updateModelDimensions]);

    if (!mergedMesh) return null;

    // PERFORMANCE: Wrap in BVH for accelerated raycasting on the complex geometry
    return (
        <Bvh firstHitOnly>
            <primitive object={mergedMesh} />
        </Bvh>
    );
};

const ObjLoaded: React.FC<{ url: string; color: string; id: string }> = ({ url, color, id }) => {
  const obj = useLoader(OBJLoader, url);
  const scene = useMemo(() => obj.clone(), [obj]);
  return <SceneProcessor scene={scene} modelId={id} color={color} isNativeYUp={false} />;
};

const StlLoaded: React.FC<{ url: string; color: string; id: string }> = ({ url, color, id }) => {
  const geom = useLoader(STLLoader, url);
  const mesh = useMemo(() => new Mesh(geom), [geom]);
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
  
  // AR STATE
  const arGenerationRequest = useStore((state) => state.arGenerationRequest);
  const setArModelUrl = useStore((state) => state.setArModelUrl);

  const [group, setGroup] = useState<Group | null>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); 
    selectModel(modelData.id);
  };

  // --- AR EXPORT LOGIC ---
  useEffect(() => {
    if (!arGenerationRequest || !isSelected || !group) return;

    // The timestamp changed, meaning a new request came in for the *selected* model.
    const exporter = new GLTFExporter();
    
    // Clone the current model state (geometry + materials + current local transforms)
    const modelClone = group.clone();
    
    // --- WRAPPER HIERARCHY ---
    // 1. Units Wrapper: 
    //    Scales everything by 0.001 to convert millimeters (Viewer) to meters (AR).
    //    This applies to both the geometry size AND the position vector relative to origin.
    const unitsWrapper = new Group();
    unitsWrapper.scale.setScalar(0.001); 
    unitsWrapper.add(modelClone);

    // 2. Orientation Wrapper:
    //    The viewer uses a Z-up coordinate system (camera.up = [0,0,1]).
    //    Standard AR/glTF is Y-up.
    //    We rotate -90 degrees around X to map Z-up data onto the Y-up world.
    const orientationWrapper = new Group();
    orientationWrapper.rotation.x = -Math.PI / 2;
    orientationWrapper.add(unitsWrapper);
    
    // Update matrices before export to ensure transforms are baked correctly into the hierarchy
    orientationWrapper.updateMatrixWorld(true);

    exporter.parse(
        orientationWrapper,
        (gltf) => {
            if (gltf instanceof ArrayBuffer) {
                const blob = new Blob([gltf], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                setArModelUrl(url);
            }
        },
        (error) => {
            console.error('An error happened during GLTF export:', error);
        },
        { binary: true } // Create .glb
    );

  }, [arGenerationRequest]); // Only trigger when the timestamp updates

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