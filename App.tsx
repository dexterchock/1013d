import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Overlay } from './components/ControlPanel';
import { AuraEffect } from './components/AuraEffect';
import { CalibrationModal } from './components/CalibrationModal';
import type { CameraControls } from '@react-three/drei';
import { useStore } from './store';

// Global JSX augmentation for the <model-viewer> custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string | null;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
        style?: React.CSSProperties;
        ref?: React.Ref<HTMLElement>;
        [key: string]: unknown;
      };
    }
  }
}

interface ModelViewerElement extends HTMLElement {
  activateAR?: () => void;
}

const ViewerScene = React.lazy(() =>
  import('./components/ViewerScene').then((module) => ({
    default: module.ViewerScene,
  }))
);

function App() {
  const controlsRef = useRef<CameraControls | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addModels = useStore((state) => state.addModels);
  const arModelUrl = useStore((state) => state.arModelUrl);
  const isArSupported = useStore((state) => state.isArSupported);
  const setArSupported = useStore((state) => state.setArSupported);
  const setArModelUrl = useStore((state) => state.setArModelUrl);

  const modelViewerRef = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isAllowed =
        ['INPUT', 'TEXTAREA', 'A'].includes(target.tagName) || target.isContentEditable;
      if (!isAllowed) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
      if (isInput) return;

      if (e.key === 'Delete') {
        const state = useStore.getState();
        if (state.selectedModelId) {
          state.removeModel(state.selectedModelId);
        }
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      setArModelUrl(null);
    };
  }, [setArModelUrl]);

  // Detect AR capability
  useEffect(() => {
    let cancelled = false;

    const checkSupport = async () => {
      let supported = false;

      const a = document.createElement('a');
      if (a.relList?.supports?.('ar')) {
        supported = true;
      } else if ('xr' in navigator) {
        const xr = (
          navigator as Navigator & {
            xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
          }
        ).xr;
        if (xr?.isSessionSupported) {
          try {
            supported = await xr.isSessionSupported('immersive-ar');
          } catch {
            supported = false;
          }
        }
      }

      if (!supported && /Android/i.test(navigator.userAgent)) {
        supported = true;
      }

      if (!cancelled) {
        setArSupported(supported);
      }
    };

    checkSupport();
    return () => {
      cancelled = true;
    };
  }, [setArSupported]);

  // Only download @google/model-viewer when the device actually supports AR
  useEffect(() => {
    if (!isArSupported) return;
    import('@google/model-viewer').catch((e) => {
      console.warn('Failed to load @google/model-viewer', e);
    });
  }, [isArSupported]);

  // Activate AR once the exported GLB finishes loading in <model-viewer>
  useEffect(() => {
    const mv = modelViewerRef.current;
    if (!arModelUrl || !mv) return;

    const handleLoad = () => {
      mv.activateAR?.();
    };

    mv.addEventListener('load', handleLoad, { once: true });
    return () => {
      mv.removeEventListener('load', handleLoad);
    };
  }, [arModelUrl]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addModels(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <main
      className="w-screen h-[100dvh] relative bg-neutral-900 selection:bg-blue-500/30 font-sans overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] to-[#000000] pointer-events-none" />

      {/* Drag Overlay Feedback */}
      <div
        className={`
          absolute inset-4 z-[200] border-2 border-dashed border-blue-500/50 bg-black/60 backdrop-blur-sm rounded-2xl
          flex items-center justify-center pointer-events-none transition-opacity duration-300
          ${isDragging ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <div className="text-blue-400 font-mono text-xl tracking-widest uppercase animate-pulse">
          Drop Files to Import
        </div>
      </div>

      {/* 3D Scene */}
      <Suspense fallback={null}>
        <ViewerScene controlsRef={controlsRef} />
      </Suspense>

      {/* UI Overlay */}
      <Overlay controlsRef={controlsRef} />

      {/* Full Screen Calibration Modal */}
      <CalibrationModal />

      {/* 1:1 Scale Aura Effect */}
      <AuraEffect />

      {/* Hidden Model Viewer for AR capabilities */}
      {isArSupported && (
        <model-viewer
          ref={modelViewerRef}
          src={arModelUrl || undefined}
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          style={{
            display: 'block',
            width: '0px',
            height: '0px',
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            visibility: 'hidden',
          }}
        />
      )}
    </main>
  );
}

export default App;
