import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLoader, useThree, ThreeEvent } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { TransformControls, Bvh } from '@react-three/drei';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import {
  MeshStandardMaterial,
  MeshBasicMaterial,
  DoubleSide,
  Object3D,
  Group,
  Mesh,
  Box3,
  Vector3,
  Matrix4,
  Material,
  Texture,
  EventDispatcher,
} from 'three';
import { useStore } from '../store';
import { LoadedModel } from '../types';
import { isIosDevice } from '../utils/arSupport';

interface ModelWrapperProps {
  modelData: LoadedModel;
}

const disposeMaterial = (mat: Material) => {
  const record = mat as unknown as Record<string, unknown>;
  for (const key in record) {
    const prop = record[key];
    if (prop && typeof prop === 'object' && (prop as Texture).isTexture) {
      (prop as Texture).dispose();
    }
  }
  mat.dispose();
};

const SceneProcessor: React.FC<{
  scene: Object3D;
  modelId: string;
  color: string;
}> = ({ scene, modelId, color }) => {
  const updateModelDimensions = useStore((state) => state.updateModelDimensions);
  const isWireframeVisible = useStore((state) => state.isWireframeVisible);
  const { invalidate } = useThree();

  const wireframeMeshesRef = useRef<Mesh[]>([]);

  const sharedMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.1,
        envMapIntensity: 1.0,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [color]
  );

  const wireframeMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ffffff',
        wireframe: true,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      sharedMaterial.dispose();
    };
  }, [sharedMaterial]);

  useEffect(() => {
    return () => {
      wireframeMaterial.dispose();
    };
  }, [wireframeMaterial]);

  useEffect(() => {
    // Reset local transforms so re-runs do not accumulate offsets.
    scene.position.set(0, 0, 0);
    scene.rotation.set(0, 0, 0);
    scene.scale.set(1, 1, 1);

    const sourceMeshes: Mesh[] = [];
    scene.traverse((child) => {
      if ((child as Mesh).isMesh && !child.userData.isWireframeOverlay) {
        sourceMeshes.push(child as Mesh);
      }
    });

    const createdOverlays: Mesh[] = [];
    const currentWireframeVisible = useStore.getState().isWireframeVisible;

    for (const mesh of sourceMeshes) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      if (mesh.geometry && !mesh.geometry.attributes.normal) {
        mesh.geometry.computeVertexNormals();
      }

      if (mesh.material) {
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of materials) {
          if (mat !== sharedMaterial) {
            disposeMaterial(mat);
          }
        }
      }

      mesh.material = sharedMaterial;

      if (mesh.geometry) {
        const wireframeOverlay = new Mesh(mesh.geometry, wireframeMaterial);
        wireframeOverlay.userData.isWireframeOverlay = true;
        wireframeOverlay.raycast = () => {};
        wireframeOverlay.visible = currentWireframeVisible;
        mesh.add(wireframeOverlay);
        createdOverlays.push(wireframeOverlay);
      }
    }

    wireframeMeshesRef.current = createdOverlays;

    // Compute bounds in scene's parent-local space, independent of outer <group> transforms.
    const box = new Box3();
    const meshBox = new Box3();
    const relMatrix = new Matrix4();
    const stack: Object3D[] = [];

    for (const mesh of sourceMeshes) {
      if (!mesh.geometry) continue;
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      if (!mesh.geometry.boundingBox) continue;

      relMatrix.identity();
      stack.length = 0;
      let curr: Object3D | null = mesh;
      while (curr) {
        curr.updateMatrix();
        stack.push(curr);
        if (curr === scene) break;
        curr = curr.parent;
      }
      for (let i = stack.length - 1; i >= 0; i--) {
        relMatrix.multiply(stack[i].matrix);
      }

      meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(relMatrix);
      box.union(meshBox);
    }

    const center = new Vector3();
    const size = new Vector3();
    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(size);
      scene.position.set(-center.x, -center.y, -center.z + size.z / 2);
    }

    updateModelDimensions(modelId, size.x, size.y, size.z);
    invalidate();

    return () => {
      for (const overlay of createdOverlays) {
        overlay.parent?.remove(overlay);
      }
      wireframeMeshesRef.current = [];
    };
  }, [scene, sharedMaterial, wireframeMaterial, modelId, updateModelDimensions, invalidate]);

  useEffect(() => {
    for (const overlay of wireframeMeshesRef.current) {
      overlay.visible = isWireframeVisible;
    }
    invalidate();
  }, [isWireframeVisible, invalidate]);

  return (
    <Bvh firstHitOnly>
      <primitive object={scene} />
    </Bvh>
  );
};

const disposeSceneGeometries = (root: Object3D) => {
  root.traverse((child) => {
    if ((child as Mesh).isMesh && !child.userData.isWireframeOverlay) {
      (child as Mesh).geometry?.dispose();
    }
  });
};

const ObjLoaded: React.FC<{ url: string; color: string; id: string }> = ({
  url,
  color,
  id,
}) => {
  const obj = useLoader(OBJLoader, url);
  const scene = useMemo(() => obj.clone(), [obj]);

  useEffect(() => {
    return () => {
      disposeSceneGeometries(scene);
      useLoader.clear(OBJLoader, url);
    };
  }, [scene, url]);

  return <SceneProcessor scene={scene} modelId={id} color={color} />;
};

const StlLoaded: React.FC<{ url: string; color: string; id: string }> = ({
  url,
  color,
  id,
}) => {
  const geom = useLoader(STLLoader, url);
  const mesh = useMemo(() => new Mesh(geom), [geom]);

  useEffect(() => {
    return () => {
      geom.dispose();
      useLoader.clear(STLLoader, url);
    };
  }, [geom, url]);

  return <SceneProcessor scene={mesh} modelId={id} color={color} />;
};

const ThreeMFLoaded: React.FC<{ url: string; color: string; id: string }> = ({
  url,
  color,
  id,
}) => {
  const object = useLoader(ThreeMFLoader, url);
  const scene = useMemo(() => object.clone(), [object]);

  useEffect(() => {
    return () => {
      disposeSceneGeometries(scene);
      useLoader.clear(ThreeMFLoader, url);
    };
  }, [scene, url]);

  return <SceneProcessor scene={scene} modelId={id} color={color} />;
};

const InnerModel: React.FC<{ modelData: LoadedModel }> = ({ modelData }) => {
  const extension = useMemo(
    () => modelData.file.name.split('.').pop()?.toLowerCase(),
    [modelData.file.name]
  );

  return (
    <group>
      {extension === 'obj' && (
        <ObjLoaded url={modelData.url} color={modelData.color} id={modelData.id} />
      )}
      {extension === 'stl' && (
        <StlLoaded url={modelData.url} color={modelData.color} id={modelData.id} />
      )}
      {extension === '3mf' && (
        <ThreeMFLoaded url={modelData.url} color={modelData.color} id={modelData.id} />
      )}
    </group>
  );
};

export const ModelWrapper: React.FC<ModelWrapperProps> = ({ modelData }) => {
  const isSelected = useStore((state) => state.selectedModelId === modelData.id);
  const position = useStore((state) => state.modelPositions[modelData.id]);
  const rotation = useStore((state) => state.modelRotations[modelData.id]);
  const scale = useStore((state) => state.modelScales[modelData.id]);
  const dimensions = useStore((state) => state.modelDimensions[modelData.id]);

  const isReady = !!dimensions && !!position;

  const gizmoMode = useStore((state) => state.gizmoMode);
  const rotationSnap = useStore((state) => state.rotationSnap);
  const selectModel = useStore((state) => state.selectModel);
  const updateModelTransform = useStore((state) => state.updateModelTransform);

  const arGenerationRequest = useStore((state) => state.arGenerationRequest);
  const clearArGenerationRequest = useStore((state) => state.clearArGenerationRequest);
  const setArAsset = useStore((state) => state.setArAsset);
  const setArError = useStore((state) => state.setArError);

  const [group, setGroup] = useState<Group | null>(null);
  const transformControlsRef = useRef<TransformControlsImpl | null>(null);
  const arExportIdRef = useRef(0);

  useEffect(() => {
    return () => {
      arExportIdRef.current += 1;
    };
  }, []);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectModel(modelData.id);
  };

  // Sync TransformControls dragging completion reliably across mouse and touch.
  useEffect(() => {
    const controls = transformControlsRef.current as unknown as
      | EventDispatcher<{ 'dragging-changed': { value: boolean } }>
      | null;
    if (!controls || !group) return;

    const handleDraggingChanged = (event: { value: boolean }) => {
      if (!event.value && group) {
        updateModelTransform(modelData.id, {
          position: { x: group.position.x, y: group.position.y, z: group.position.z },
          rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
          scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z },
        });
      }
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [group, isSelected, isReady, modelData.id, updateModelTransform]);

  // AR USDZ (iOS) / GLB (Android & WebXR) export, lazy-loading only the needed exporter
  useEffect(() => {
    if (!arGenerationRequest || !isSelected || !group) return;

    const exportId = ++arExportIdRef.current;
    clearArGenerationRequest();

    const buildArExportScene = (sourceGroup: Group): Group => {
      const modelClone = sourceGroup.clone();

      // Strip wireframe overlays so they are never exported into AR.
      const overlaysToRemove: Object3D[] = [];
      modelClone.traverse((child) => {
        if (child.userData.isWireframeOverlay) {
          overlaysToRemove.push(child);
        }
      });
      for (const overlay of overlaysToRemove) {
        overlay.parent?.remove(overlay);
      }

      // Remove build-plate layout offset while keeping user rotation and scale.
      modelClone.position.set(0, 0, 0);

      // Millimeters (viewer) -> Meters (AR)
      const unitsWrapper = new Group();
      unitsWrapper.scale.setScalar(0.001);
      unitsWrapper.add(modelClone);

      // Z-up (viewer) -> Y-up (AR)
      const orientationWrapper = new Group();
      orientationWrapper.rotation.x = -Math.PI / 2;
      orientationWrapper.add(unitsWrapper);
      orientationWrapper.updateMatrixWorld(true);

      // Center X/Z at origin and rest the lowest geometry point on Y = 0.
      const floorWrapper = new Group();
      floorWrapper.add(orientationWrapper);
      const bounds = new Box3().setFromObject(orientationWrapper);
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new Vector3());
        floorWrapper.position.set(-center.x, -bounds.min.y, -center.z);
      }
      floorWrapper.updateMatrixWorld(true);
      return floorWrapper;
    };

    const baseName =
      modelData.file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'model';

    const exportArAsset = async () => {
      try {
        const exportScene = buildArExportScene(group);

        if (isIosDevice()) {
          const { USDZExporter } = await import(
            'three/examples/jsm/exporters/USDZExporter.js'
          );
          if (exportId !== arExportIdRef.current) return;

          const exporter = new USDZExporter();
          const arrayBuffer = await exporter.parseAsync(exportScene, {
            quickLookCompatible: true,
          });
          if (exportId !== arExportIdRef.current) return;

          const blob = new Blob([arrayBuffer], { type: 'model/vnd.usdz+zip' });
          setArAsset('usdz', URL.createObjectURL(blob), baseName);
          return;
        }

        const { GLTFExporter } = await import(
          'three/examples/jsm/exporters/GLTFExporter.js'
        );
        if (exportId !== arExportIdRef.current) return;

        const exporter = new GLTFExporter();
        const gltf = await exporter.parseAsync(exportScene, { binary: true });
        if (exportId !== arExportIdRef.current) return;

        if (!(gltf instanceof ArrayBuffer)) {
          throw new Error('Expected binary GLB output from GLTFExporter.');
        }

        const blob = new Blob([gltf], { type: 'model/gltf-binary' });
        setArAsset('glb', URL.createObjectURL(blob), baseName);
      } catch (error) {
        if (exportId !== arExportIdRef.current) return;
        console.error('AR export failed:', error);
        setArError('Could not prepare this model for AR.');
      }
    };

    void exportArAsset();
  }, [
    arGenerationRequest,
    isSelected,
    group,
    modelData.file.name,
    clearArGenerationRequest,
    setArAsset,
    setArError,
  ]);

  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;
  const posZ = position?.z ?? 0;
  const rotX = rotation?.x ?? 0;
  const rotY = rotation?.y ?? 0;
  const rotZ = rotation?.z ?? 0;
  const scaleX = scale?.x ?? 1;
  const scaleY = scale?.y ?? 1;
  const scaleZ = scale?.z ?? 1;

  return (
    <>
      {isSelected && group && isReady && (
        <TransformControls
          ref={transformControlsRef}
          object={group}
          mode={gizmoMode}
          enabled={true}
          rotationSnap={rotationSnap ?? undefined}
          size={0.8}
          space="local"
        />
      )}
      <group
        ref={setGroup}
        position={[posX, posY, posZ]}
        rotation={[rotX, rotY, rotZ]}
        scale={[scaleX, scaleY, scaleZ]}
        onClick={handleClick}
        visible={isReady && modelData.visible}
      >
        <InnerModel modelData={modelData} />
      </group>
    </>
  );
};
