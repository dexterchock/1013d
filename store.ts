import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ViewerState,
  DEFAULT_PPI,
  MIN_PPI,
  MAX_PPI,
  LoadedModel,
  Vec3,
} from './types';

const VALID_EXTENSIONS = new Set(['obj', 'stl', '3mf']);
const LAYOUT_GAP = 10;

const generateModelColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 60%, 50%)`;
};

const generateModelId = (): string => {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  return `model-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getDefaultScreenSize = () => ({
  width: typeof window !== 'undefined' ? window.screen.width : 1920,
  height: typeof window !== 'undefined' ? window.screen.height : 1080,
});

/**
 * Assigns initial X-axis positions to newly dimensioned models without
 * overwriting any positions that already exist (including user drags).
 */
const layoutNewModels = (
  models: LoadedModel[],
  dimensions: Record<string, Vec3>,
  existingPositions: Record<string, Vec3>,
  scales: Record<string, Vec3>
): Record<string, Vec3> => {
  const nextPositions: Record<string, Vec3> = { ...existingPositions };
  const newlyDimensioned: LoadedModel[] = [];
  let hasPositionedModels = false;
  let maxRightEdge = -Infinity;

  for (const model of models) {
    const dim = dimensions[model.id];
    const existingPos = existingPositions[model.id];

    if (existingPos) {
      hasPositionedModels = true;
      if (dim) {
        const scaleX = Math.abs(scales[model.id]?.x ?? 1);
        const halfWidth = (dim.x * scaleX) / 2;
        maxRightEdge = Math.max(maxRightEdge, existingPos.x + halfWidth);
      }
    } else if (dim) {
      newlyDimensioned.push(model);
    }
  }

  if (newlyDimensioned.length === 0) {
    return nextPositions;
  }

  if (!hasPositionedModels) {
    // Fresh plate: center the initial batch around X = 0.
    let currentX = 0;
    for (const model of newlyDimensioned) {
      const dim = dimensions[model.id];
      const scaleX = Math.abs(scales[model.id]?.x ?? 1);
      const width = dim.x * scaleX;
      nextPositions[model.id] = { x: currentX + width / 2, y: 0, z: 0 };
      currentX += width + LAYOUT_GAP;
    }

    const totalWidth = currentX - LAYOUT_GAP;
    const shiftX = totalWidth > 0 ? -totalWidth / 2 : 0;
    for (const model of newlyDimensioned) {
      nextPositions[model.id] = {
        ...nextPositions[model.id],
        x: nextPositions[model.id].x + shiftX,
      };
    }
    return nextPositions;
  }

  // Append newly loaded models to the right of existing ones.
  let cursorX = Number.isFinite(maxRightEdge) ? maxRightEdge + LAYOUT_GAP : 0;
  for (const model of newlyDimensioned) {
    const dim = dimensions[model.id];
    const scaleX = Math.abs(scales[model.id]?.x ?? 1);
    const width = dim.x * scaleX;
    nextPositions[model.id] = { x: cursorX + width / 2, y: 0, z: 0 };
    cursorX += width + LAYOUT_GAP;
  }

  return nextPositions;
};

// Debounce state for batching simultaneous model dimension updates.
let dimensionUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDimensionUpdates: Record<string, Vec3> = {};

export type ArStatus = 'idle' | 'preparing' | 'ready' | 'presenting' | 'error';

export interface ArState {
  isArSupported: boolean;
  arStatus: ArStatus;
  arGenerationRequest: number | null;
  arModelUrl: string | null;
  arUsdzUrl: string | null;
  arFileName: string | null;
  arError: string | null;
  setArSupported: (supported: boolean) => void;
  triggerArGeneration: () => void;
  clearArGenerationRequest: () => void;
  setArAsset: (kind: 'usdz' | 'glb', url: string, fileName: string) => void;
  setArPresenting: () => void;
  setArError: (message: string) => void;
  closeArSession: () => void;
}

const initialScreen = getDefaultScreenSize();

const IDLE_AR_RESET = {
  arStatus: 'idle' as const,
  arGenerationRequest: null,
  arModelUrl: null,
  arUsdzUrl: null,
  arFileName: null,
  arError: null,
};

const revokeAndResetAr = (state: {
  arModelUrl: string | null;
  arUsdzUrl: string | null;
}) => {
  if (state.arModelUrl) URL.revokeObjectURL(state.arModelUrl);
  if (state.arUsdzUrl) URL.revokeObjectURL(state.arUsdzUrl);
  return IDLE_AR_RESET;
};

const removeModelFromState = (
  state: ViewerState & ArState,
  id: string
): Partial<ViewerState & ArState> => {
  const newModels = state.models.filter((m) => m.id !== id);
  const { [id]: _dim, ...remainingDimensions } = state.modelDimensions;
  const { [id]: _rot, ...remainingRotations } = state.modelRotations;
  const { [id]: _scale, ...remainingScales } = state.modelScales;
  const { [id]: _pos, ...remainingPositions } = state.modelPositions;

  const isRemovingSelected = state.selectedModelId === id;
  const arUpdates =
    isRemovingSelected && state.arStatus !== 'idle' ? revokeAndResetAr(state) : {};

  return {
    models: newModels,
    selectedModelId: isRemovingSelected ? null : state.selectedModelId,
    modelDimensions: remainingDimensions,
    modelRotations: remainingRotations,
    modelScales: remainingScales,
    modelPositions: remainingPositions,
    ...arUpdates,
  };
};

export const useStore = create<ViewerState & ArState>()(
  persist(
    (set, get) => ({
      models: [],
      selectedModelId: null,
      ppi: DEFAULT_PPI,
      isWireframeVisible: false,
      gizmoMode: 'translate',
      rotationSnap: Math.PI / 4,
      sidebarOpen: true,
      is1to1Mode: false,
      isRulerVisible: false,
      isCalibrationModalOpen: false,
      uploadError: null,

      isArSupported: false,
      arStatus: 'idle',
      arGenerationRequest: null,
      arModelUrl: null,
      arUsdzUrl: null,
      arFileName: null,
      arError: null,

      calibrationSettings: {
        resolutionWidth: initialScreen.width,
        resolutionHeight: initialScreen.height,
        diagonalInches: 24,
      },

      modelDimensions: {},
      modelPositions: {},
      modelRotations: {},
      modelScales: {},

      addModels: (files) => {
        const validFiles: File[] = [];
        const rejectedNames: string[] = [];

        for (const file of files) {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext && VALID_EXTENSIONS.has(ext)) {
            validFiles.push(file);
          } else {
            rejectedNames.push(file.name);
          }
        }

        const uploadError =
          rejectedNames.length > 0
            ? `Unsupported format (${rejectedNames.join(', ')}). Use .obj, .stl, or .3mf.`
            : null;

        if (validFiles.length === 0) {
          if (uploadError) set({ uploadError });
          return;
        }

        const newModels: LoadedModel[] = validFiles.map((file) => ({
          id: generateModelId(),
          file,
          color: generateModelColor(),
          visible: true,
        }));

        set((state) => {
          const updatedModels = [...state.models, ...newModels];
          const newRotations = { ...state.modelRotations };
          const newScales = { ...state.modelScales };

          for (const model of newModels) {
            newRotations[model.id] = { x: 0, y: 0, z: 0 };
            newScales[model.id] = { x: 1, y: 1, z: 1 };
          }

          return {
            models: updatedModels,
            selectedModelId: newModels[newModels.length - 1].id,
            modelRotations: newRotations,
            modelScales: newScales,
            uploadError,
          };
        });
      },

      addExampleModel: async () => {
        try {
          const { cubeData } = await import('./cubeData');
          const blob = new Blob([cubeData], { type: 'application/octet-stream' });
          const file = new File([blob], 'Calibration_cube.stl', {
            type: 'application/octet-stream',
          });
          get().addModels([file]);
        } catch (error) {
          console.error('Error loading embedded example model:', error);
          set({ uploadError: 'Failed to load example model.' });
        }
      },

      removeModel: (id) => {
        // Drop any queued dimension updates for this model before the debounce fires.
        delete pendingDimensionUpdates[id];

        set((state) => removeModelFromState(state, id));
      },

      failModelLoad: (id, message) => {
        delete pendingDimensionUpdates[id];

        set((state) => ({
          ...removeModelFromState(state, id),
          uploadError: message,
        }));
      },

      selectModel: (id) => set({ selectedModelId: id }),

      setPPI: (ppi) => {
        if (typeof ppi === 'number' && Number.isFinite(ppi) && ppi > 0) {
          const clamped = Math.min(MAX_PPI, Math.max(MIN_PPI, ppi));
          set({ ppi: clamped });
        }
      },

      setCalibrationSettings: (settings) =>
        set((state) => ({
          calibrationSettings: { ...state.calibrationSettings, ...settings },
        })),

      toggleWireframe: () => set((state) => ({ isWireframeVisible: !state.isWireframeVisible })),

      setGizmoMode: (mode) => set({ gizmoMode: mode }),

      setRotationSnap: (angleDeg) =>
        set({
          rotationSnap: angleDeg ? angleDeg * (Math.PI / 180) : null,
        }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      set1to1Mode: (is1to1) => set({ is1to1Mode: is1to1 }),

      toggleRuler: () => set((state) => ({ isRulerVisible: !state.isRulerVisible })),

      setCalibrationModalOpen: (isOpen) => set({ isCalibrationModalOpen: isOpen }),

      clearUploadError: () => set({ uploadError: null }),

      updateModelDimensions: (id, x, y, z) => {
        pendingDimensionUpdates[id] = { x, y, z };

        if (dimensionUpdateTimer) clearTimeout(dimensionUpdateTimer);

        dimensionUpdateTimer = setTimeout(() => {
          dimensionUpdateTimer = null;
          set((state) => {
            const activeIds = new Set(state.models.map((m) => m.id));
            const validUpdates: Record<string, Vec3> = {};

            for (const [modelId, dim] of Object.entries(pendingDimensionUpdates)) {
              if (activeIds.has(modelId)) {
                validUpdates[modelId] = dim;
              }
            }
            pendingDimensionUpdates = {};

            if (Object.keys(validUpdates).length === 0) {
              return {};
            }

            const newDimensions = {
              ...state.modelDimensions,
              ...validUpdates,
            };

            const newPositions = layoutNewModels(
              state.models,
              newDimensions,
              state.modelPositions,
              state.modelScales
            );

            return {
              modelDimensions: newDimensions,
              modelPositions: newPositions,
            };
          });
        }, 50);
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
      },

      setArSupported: (supported) => set({ isArSupported: supported }),
      triggerArGeneration: () =>
        set((state) => ({
          ...revokeAndResetAr(state),
          arGenerationRequest: Date.now(),
          arStatus: 'preparing',
        })),
      clearArGenerationRequest: () => set({ arGenerationRequest: null }),

      setArAsset: (kind, url, fileName) =>
        set((state) => {
          if (state.arModelUrl && state.arModelUrl !== url) {
            URL.revokeObjectURL(state.arModelUrl);
          }
          if (state.arUsdzUrl && state.arUsdzUrl !== url) {
            URL.revokeObjectURL(state.arUsdzUrl);
          }
          return kind === 'usdz'
            ? {
                arUsdzUrl: url,
                arModelUrl: null,
                arFileName: fileName,
                arStatus: 'ready',
                arError: null,
              }
            : {
                arModelUrl: url,
                arUsdzUrl: null,
                arFileName: fileName,
                arStatus: 'ready',
                arError: null,
              };
        }),

      setArPresenting: () => set({ arStatus: 'presenting', arError: null }),

      setArError: (message) =>
        set({
          arStatus: 'error',
          arError: message,
          arGenerationRequest: null,
        }),

      closeArSession: () => set((state) => revokeAndResetAr(state)),
    }),
    {
      name: '1to13d-storage',
      partialize: (state) => ({
        ppi: state.ppi,
        calibrationSettings: {
          diagonalInches: state.calibrationSettings.diagonalInches,
        },
      }),
      merge: (persistedState: unknown, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<ViewerState>;
        const screen = getDefaultScreenSize();

        const rawPpi = persisted.ppi;
        const validPpi =
          typeof rawPpi === 'number' && Number.isFinite(rawPpi) && rawPpi > 0
            ? Math.min(MAX_PPI, Math.max(MIN_PPI, rawPpi))
            : currentState.ppi;

        const rawDiagonal = persisted.calibrationSettings?.diagonalInches;
        const validDiagonal =
          typeof rawDiagonal === 'number' && Number.isFinite(rawDiagonal) && rawDiagonal > 0
            ? Math.min(200, Math.max(1, rawDiagonal))
            : currentState.calibrationSettings.diagonalInches;

        return {
          ...currentState,
          ppi: validPpi,
          calibrationSettings: {
            resolutionWidth: screen.width,
            resolutionHeight: screen.height,
            diagonalInches: validDiagonal,
          },
        };
      },
    }
  )
);
