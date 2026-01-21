
import { create } from 'zustand';
import { ViewerState, DEFAULT_PPI, LoadedModel } from './types';

// Helper to generate distinct colors
// Changed from pastel (80% lightness) to a deeper shade (50% lightness) 
// to avoid blown-out highlights in the viewer.
const generateModelColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 60%, 50%)`;
};

// Local storage key
const PPI_STORAGE_KEY = '1to13d_ppi_calibration';

const getInitialPPI = () => {
  const saved = localStorage.getItem(PPI_STORAGE_KEY);
  return saved ? parseFloat(saved) : DEFAULT_PPI;
};

// Layout Configuration
const LAYOUT_GAP = 10; // 10mm gap as requested

// Helper to recalculate positions based on current models and their dimensions
const calculatePositions = (
  models: LoadedModel[], 
  dimensions: Record<string, { x: number; y: number; z: number }>
) => {
  const positions: Record<string, { x: number; y: number; z: number }> = {};
  
  // We'll arrange them in a simple row along X axis for now to ensure tight packing
  // (Grid is harder to pack tightly with variable sizes without a bin-packer)
  let currentX = 0;

  models.forEach((model, index) => {
    const dim = dimensions[model.id] || { x: 100, y: 100, z: 100 }; // Default size if not loaded
    
    // Centered pivot assumption from Model.tsx
    const halfWidth = dim.x / 2;
    
    // Place center at currentX + halfWidth
    // But we want to start the whole group centered? 
    // For now, let's just grow to the right.
    
    // If it's the first model, place it at 0? 
    // Or place the *start* of the model at currentX.
    // Since pivot is center:
    const centerX = currentX + halfWidth;
    
    positions[model.id] = { x: centerX, y: 0, z: 0 };
    
    currentX += dim.x + LAYOUT_GAP;
  });

  // Optional: Center the whole group
  const totalWidth = currentX - LAYOUT_GAP;
  const shiftX = -totalWidth / 2;
  
  Object.keys(positions).forEach(key => {
    positions[key].x += shiftX;
  });

  return positions;
};

export const useStore = create<ViewerState>((set, get) => ({
  models: [],
  selectedModelId: null,
  ppi: getInitialPPI(),
  isGridVisible: true,
  gizmoMode: 'translate', // Default to move
  rotationSnap: Math.PI / 4, // Default 45 degrees
  sidebarOpen: true,
  is1to1Mode: false,
  isCalibrationModalOpen: false,
  modelDimensions: {},
  modelPositions: {},
  modelRotations: {},
  modelScales: {},

  addModels: (files) => {
    const newModels: LoadedModel[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      color: generateModelColor(),
      visible: true,
    }));
    
    set((state) => {
      const updatedModels = [...state.models, ...newModels];
      
      // Initialize rotations and scales
      const newRotations = { ...state.modelRotations };
      const newScales = { ...state.modelScales };
      newModels.forEach(m => {
          newRotations[m.id] = { x: 0, y: 0, z: 0 };
          newScales[m.id] = { x: 1, y: 1, z: 1 };
      });

      return { 
        models: updatedModels,
        selectedModelId: newModels.length > 0 ? newModels[newModels.length - 1].id : state.selectedModelId,
        // Recalculate with existing dimensions (new models have 0/default dims initially)
        modelPositions: calculatePositions(updatedModels, state.modelDimensions),
        modelRotations: newRotations,
        modelScales: newScales
      };
    });
  },

  addExampleModel: () => {
    // Create a dummy file that Model.tsx will recognize by extension
    const file = new File(["cube"], "20mm_Calibration_Cube.cube", { type: 'application/octet-stream' });
    get().addModels([file]);
  },

  removeModel: (id) => {
    set((state) => {
      const model = state.models.find((m) => m.id === id);
      if (model) URL.revokeObjectURL(model.url);
      
      const newModels = state.models.filter((m) => m.id !== id);
      const { [id]: removedDim, ...remainingDimensions } = state.modelDimensions;
      const { [id]: removedRot, ...remainingRotations } = state.modelRotations;
      const { [id]: removedScale, ...remainingScales } = state.modelScales;
      const { [id]: removedPos, ...remainingPositions } = state.modelPositions; // Manually remove key, then recalc
      
      return { 
        models: newModels,
        selectedModelId: state.selectedModelId === id ? null : state.selectedModelId,
        modelDimensions: remainingDimensions,
        modelRotations: remainingRotations,
        modelScales: remainingScales,
        modelPositions: calculatePositions(newModels, remainingDimensions)
      };
    });
  },

  selectModel: (id) => set({ 
    selectedModelId: id,
    // Removed gizmoMode reset here to persist user's tool choice
  }),

  setPPI: (ppi) => {
    localStorage.setItem(PPI_STORAGE_KEY, ppi.toString());
    set({ ppi });
  },

  toggleGrid: () => set((state) => ({ isGridVisible: !state.isGridVisible })),
  setGizmoMode: (mode) => set({ gizmoMode: mode }),
  
  setRotationSnap: (angleDeg) => set({ 
    rotationSnap: angleDeg ? angleDeg * (Math.PI / 180) : null 
  }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  set1to1Mode: (is1to1) => set({ is1to1Mode: is1to1 }),
  
  setCalibrationModalOpen: (isOpen) => set({ isCalibrationModalOpen: isOpen }),

  updateModelDimensions: (id, x, y, z) => {
    set((state) => {
        // Only update if changed significantly to avoid loops
        const current = state.modelDimensions[id];
        if (current && Math.abs(current.x - x) < 0.1 && Math.abs(current.y - y) < 0.1) {
            return {};
        }

        const newDimensions = {
            ...state.modelDimensions,
            [id]: { x, y, z }
        };

        return {
            modelDimensions: newDimensions,
            modelPositions: calculatePositions(state.models, newDimensions)
        };
    });
  },

  updateModelTransform: (id, transform) => {
      set((state) => {
          const updates: Partial<ViewerState> = {};
          if (transform.position) {
              updates.modelPositions = { ...state.modelPositions, [id]: transform.position };
          }
          if (transform.rotation) {
              updates.modelRotations = { ...state.modelRotations, [id]: transform.rotation };
          }
          if (transform.scale) {
              updates.modelScales = { ...state.modelScales, [id]: transform.scale };
          }
          return updates;
      });
  }
}));
