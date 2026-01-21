
export type Axis = 'X' | '-X' | 'Y' | '-Y' | 'Z' | '-Z';

export interface LoadedModel {
  id: string;
  file: File;
  url: string;
  color: string;
  visible: boolean;
}

export interface ViewerState {
  models: LoadedModel[];
  selectedModelId: string | null; // Track which model is selected
  ppi: number; // Pixels Per Inch
  isGridVisible: boolean;
  gizmoMode: 'translate' | 'rotate' | 'scale';
  rotationSnap: number | null; // in radians
  sidebarOpen: boolean;
  is1to1Mode: boolean; // Track if we are in 1:1 view mode
  
  // Modal State
  isCalibrationModalOpen: boolean;
  
  // Calibration Calculator Persistence
  calibrationSettings: {
    resolutionWidth: number;
    resolutionHeight: number;
    diagonalInches: number;
  };

  // Auto-layout state
  modelDimensions: Record<string, { x: number; y: number; z: number }>;
  modelPositions: Record<string, { x: number; y: number; z: number }>;
  modelRotations: Record<string, { x: number; y: number; z: number }>; // in radians
  modelScales: Record<string, { x: number; y: number; z: number }>;

  // Actions
  addModels: (files: File[], isInternal?: boolean) => void;
  addExampleModel: () => void;
  removeModel: (id: string) => void;
  selectModel: (id: string | null) => void; // Action to select/deselect
  setPPI: (ppi: number) => void;
  setCalibrationSettings: (settings: Partial<ViewerState['calibrationSettings']>) => void;
  toggleGrid: () => void;
  setGizmoMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  setRotationSnap: (angleDeg: number | null) => void;
  toggleSidebar: () => void;
  set1to1Mode: (is1to1: boolean) => void;
  setCalibrationModalOpen: (isOpen: boolean) => void;
  updateModelDimensions: (id: string, x: number, y: number, z: number) => void;
  updateModelTransform: (id: string, transform: { 
    position?: {x: number, y: number, z: number}, 
    rotation?: {x: number, y: number, z: number}, 
    scale?: {x: number, y: number, z: number} 
  }) => void;
}

export const DEFAULT_PPI = 96;
