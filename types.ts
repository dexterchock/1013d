export type Axis = 'X' | '-X' | 'Y' | '-Y' | 'Z' | '-Z';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LoadedModel {
  id: string;
  file: File;
  url: string;
  color: string;
  visible: boolean;
}

export interface ViewerState {
  models: LoadedModel[];
  selectedModelId: string | null;
  ppi: number; // Pixels Per Inch
  isGridVisible: boolean;
  isWireframeVisible: boolean;
  gizmoMode: 'translate' | 'rotate' | 'scale';
  rotationSnap: number | null; // in radians
  sidebarOpen: boolean;
  is1to1Mode: boolean;
  isCalibrationModalOpen: boolean;
  uploadError: string | null;

  calibrationSettings: {
    resolutionWidth: number;
    resolutionHeight: number;
    diagonalInches: number;
  };

  // Per-model geometry & transform state
  modelDimensions: Record<string, Vec3>;
  modelPositions: Record<string, Vec3>;
  modelRotations: Record<string, Vec3>; // in radians
  modelScales: Record<string, Vec3>;

  // Actions
  addModels: (files: File[]) => void;
  addExampleModel: () => Promise<void>;
  removeModel: (id: string) => void;
  selectModel: (id: string | null) => void;
  setPPI: (ppi: number) => void;
  setCalibrationSettings: (settings: Partial<ViewerState['calibrationSettings']>) => void;
  toggleGrid: () => void;
  toggleWireframe: () => void;
  setGizmoMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  setRotationSnap: (angleDeg: number | null) => void;
  toggleSidebar: () => void;
  set1to1Mode: (is1to1: boolean) => void;
  setCalibrationModalOpen: (isOpen: boolean) => void;
  clearUploadError: () => void;
  updateModelDimensions: (id: string, x: number, y: number, z: number) => void;
  updateModelTransform: (
    id: string,
    transform: {
      position?: Vec3;
      rotation?: Vec3;
      scale?: Vec3;
    }
  ) => void;
}

export const DEFAULT_PPI = 96;
export const MIN_PPI = 10;
export const MAX_PPI = 1000;
