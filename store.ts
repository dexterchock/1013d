import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ViewerState, DEFAULT_PPI, LoadedModel } from './types';

// --- Helper Functions ---

const generateModelColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 60%, 50%)`;
};

const LAYOUT_GAP = 10; 

// Helper to recalculate positions
const calculatePositions = (
  models: LoadedModel[], 
  dimensions: Record<string, { x: number; y: number; z: number }>
) => {
  const positions: Record<string, { x: number; y: number; z: number }> = {};
  let currentX = 0;

  models.forEach((model) => {
    const dim = dimensions[model.id];

    // FIX: If dimensions are unknown (loading), ignore this model in the layout.
    // This prevents existing models from "jumping" to make room for a default 100mm 
    // placeholder, only to "jump back" when the real (smaller) size is found.
    if (!dim) {
        positions[model.id] = { x: 0, y: 0, z: 0 };
        return; 
    }

    const halfWidth = dim.x / 2;
    const centerX = currentX + halfWidth;
    
    positions[model.id] = { x: centerX, y: 0, z: 0 };
    currentX += dim.x + LAYOUT_GAP;
  });

  const totalWidth = currentX - LAYOUT_GAP;
  // If no models have dimensions yet, prevent division issues (though shiftX=0 is fine)
  const shiftX = currentX > 0 ? -totalWidth / 2 : 0;
  
  Object.keys(positions).forEach(key => {
    // Only shift models that were actually part of the layout
    if (dimensions[key]) {
        positions[key].x += shiftX;
    }
  });

  return positions;
};

// --- Store Implementation ---

export const useStore = create<ViewerState>()(
  persist(
    (set, get) => ({
      // Initial State
      models: [],
      selectedModelId: null,
      ppi: DEFAULT_PPI,
      isGridVisible: true,
      gizmoMode: 'translate',
      rotationSnap: Math.PI / 4, // Default 45 degrees
      sidebarOpen: true,
      is1to1Mode: false,
      isCalibrationModalOpen: false,
      
      calibrationSettings: {
          resolutionWidth: window.screen.width,
          resolutionHeight: window.screen.height,
          diagonalInches: 24
      },

      modelDimensions: {},
      modelPositions: {},
      modelRotations: {},
      modelScales: {},

      // Actions
      addModels: (files, isInternal = false) => {
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
          
          const newRotations = { ...state.modelRotations };
          const newScales = { ...state.modelScales };
          newModels.forEach(m => {
              newRotations[m.id] = { x: 0, y: 0, z: 0 };
              newScales[m.id] = { x: 1, y: 1, z: 1 };
          });

          return { 
            models: updatedModels,
            selectedModelId: newModels.length > 0 ? newModels[newModels.length - 1].id : state.selectedModelId,
            modelPositions: calculatePositions(updatedModels, state.modelDimensions),
            modelRotations: newRotations,
            modelScales: newScales
          };
        });
      },

      addExampleModel: async () => {
        try {
            // Dynamically import data to save initial bundle size
            const { cubeData } = await import('./cubeData');

            // 1. Create Blob directly from the imported Uint8Array
            // This bypasses fetch, servers, and base64 decoding entirely.
            const blob = new Blob([cubeData], { type: 'application/octet-stream' });

            // 2. Create a File object from the Blob
            const file = new File([blob], 'Calibration_cube.stl', { 
                type: 'application/octet-stream' 
            });

            // 3. Add to the scene using the standard loader
            get().addModels([file], true);

        } catch (error) {
            console.error("Error loading embedded example model:", error);
        }
      },

      removeModel: (id) => {
        set((state) => {
          const model = state.models.find((m) => m.id === id);
          if (model) URL.revokeObjectURL(model.url);
          
          const newModels = state.models.filter((m) => m.id !== id);
          
          // Clean up associated state maps
          const { [id]: removedDim, ...remainingDimensions } = state.modelDimensions;
          const { [id]: removedRot, ...remainingRotations } = state.modelRotations;
          const { [id]: removedScale, ...remainingScales } = state.modelScales;
          const { [id]: removedPos, ...remainingPositions } = state.modelPositions;
          
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
      }),

      setPPI: (ppi) => {
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
            const current = state.modelDimensions[id];
            // Prevent infinite loops by checking if the change is significant
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
      name: '1to13d-storage', 
      partialize: (state) => ({ 
          // We persist PPI and Calibration, but NOT the models themselves
          // because Blob URLs cannot be saved to localStorage.
          ppi: state.ppi,
          // Only persist diagonalInches. We specifically exclude resolution so it is
          // always re-evaluated from the browser environment on load.
          calibrationSettings: {
              diagonalInches: state.calibrationSettings.diagonalInches
          }
      }), 
      merge: (persistedState: any, currentState) => {
        return {
            ...currentState,
            ...persistedState,
            calibrationSettings: {
                ...currentState.calibrationSettings, // Has default window.screen values
                ...(persistedState.calibrationSettings || {}), // Overwrites diagonalInches
                // Force fresh window dimensions to handle DPR/resolution changes between sessions
                resolutionWidth: window.screen.width,
                resolutionHeight: window.screen.height,
            }
        };
      },
    }
  )
);