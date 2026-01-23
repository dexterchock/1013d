import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ViewerState, DEFAULT_PPI, LoadedModel } from './types';

// Helper to generate distinct colors
// Changed from pastel (80% lightness) to a deeper shade (50% lightness) 
// to avoid blown-out highlights in the viewer.
const generateModelColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 60%, 50%)`;
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
  let currentX = 0;

  models.forEach((model, index) => {
    const dim = dimensions[model.id] || { x: 100, y: 100, z: 100 }; // Default size if not loaded
    
    // Centered pivot assumption from Model.tsx
    const halfWidth = dim.x / 2;
    
    // Place center at currentX + halfWidth
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

export const useStore = create<ViewerState>()(
  persist(
    (set, get) => ({
      models: [],
      selectedModelId: null,
      ppi: DEFAULT_PPI,
      isGridVisible: true,
      gizmoMode: 'translate', // Default to move
      rotationSnap: Math.PI / 4, // Default 45 degrees
      sidebarOpen: true,
      is1to1Mode: false,
      isCalibrationModalOpen: false,
      
      // Default calibration settings based on typical screen
      calibrationSettings: {
          resolutionWidth: window.screen.width,
          resolutionHeight: window.screen.height,
          diagonalInches: 24
      },

      modelDimensions: {},
      modelPositions: {},
      modelRotations: {},
      modelScales: {},

      addModels: (files, isInternal = false) => {
        // Validate file extensions
        const validExtensions = ['obj', 'stl', '3mf'];
        
        const validFiles = files.filter((file) => {
            const ext = file.name.split('.').pop()?.toLowerCase();
            return ext && validExtensions.includes(ext);
        });

        if (validFiles.length === 0) return;

        const newModels: LoadedModel[] = validFiles.map((file) => ({
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

      addExampleModel: async () => {
        try {
            const response = await fetch('/Calibration_cube.bin');
            if (!response.ok) throw new Error('Failed to load example model');
            const blob = await response.blob();
            const file = new File([blob], 'Calibration_cube.stl', { type: 'model/stl' });
            get().addModels([file], true);
        } catch (error) {
            console.error("Error loading example model:", error);
        }
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
        // Validate to ensure we don't save NaN or invalid values
        if (typeof ppi === 'number' && isFinite(ppi) && ppi > 0) {
            set({ ppi });
        }
      },

      setCalibrationSettings: (settings) => set((state) => ({
        calibrationSettings: { ...state.calibrationSettings, ...settings }
      })),

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
    }),
    {
      name: '1to13d-storage', // Unique name for localStorage key
      partialize: (state) => ({ 
          // We only persist the PPI and Calibration Settings.
          // Models contain Blob URLs which are not serializable or persistent across reloads.
          ppi: state.ppi,
          calibrationSettings: state.calibrationSettings
      }), 
    }
  )
);
