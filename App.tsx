import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Overlay } from './components/ControlPanel';
import { AuraEffect } from './components/AuraEffect';
import { ScreenRuler } from './components/ScreenRuler';
import { CalibrationModal } from './components/CalibrationModal';
import { ArLaunchModal } from './components/ArLaunchModal';
import type { CameraControls } from '@react-three/drei';
import { useStore } from './store';
import { detectArSupport, isIosDevice } from './utils/arSupport';

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
        'ar-scale'?: string;
        'camera-controls'?: boolean;
        style?: React.CSSProperties;
        ref?: React.Ref<HTMLElement>;
        [key: string]: unknown;
      };
    }
  }
}

interface ModelViewerElement extends HTMLElement {
  activateAR?: () => Promise<void> | void;
  canActivateAR?: boolean;
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
  const setArPresenting = useStore((state) => state.setArPresenting);
  const setArError = useStore((state) => state.setArError);
  const closeArSession = useStore((state) => state.closeArSession);

  const [isWebArReady, setIsWebArReady] = useState(false);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  const isIos = isIosDevice();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        !target ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable;
      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useStore.getState();
        if (state.isCalibrationModalOpen || state.arStatus !== 'idle') return;
        if (state.selectedModelId) {
          state.removeModel(state.selectedModelId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      closeArSession();
    };
  }, [closeArSession]);

  // Detect AR capability
  useEffect(() => {
    let cancelled = false;

    const checkSupport = async () => {
      const supported = await detectArSupport();
      if (!cancelled) {
        setArSupported(supported);
      }
    };

    void checkSupport();
    return () => {
      cancelled = true;
    };
  }, [setArSupported]);

  // Only download @google/model-viewer on non-iOS AR devices (iOS uses direct USDZ + rel="ar")
  useEffect(() => {
    if (!isArSupported || isIos) return;
    import('@google/model-viewer').catch((e) => {
      console.warn('Failed to load @google/model-viewer', e);
    });
  }, [isArSupported, isIos]);

  // Sync WebXR readiness and session lifecycle with <model-viewer> (keeps blob URL alive while presenting)
  useEffect(() => {
    setIsWebArReady(false);
    const mv = modelViewerRef.current;
    if (!arModelUrl || !mv || isIos) return;

    const handleLoad = () => {
      setIsWebArReady(true);
    };

    const handleError = () => {
      setIsWebArReady(false);
      setArError('Failed to load model into WebXR viewer.');
    };

    const handleArStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status?: string }>).detail?.status;
      if (status === 'session-started') {
        setArPresenting();
      } else if (status === 'not-presenting') {
        if (useStore.getState().arStatus === 'presenting') {
          closeArSession();
        }
      } else if (status === 'failed') {
        setArError('Could not start AR session on this device.');
      }
    };

    mv.addEventListener('load', handleLoad);
    mv.addEventListener('error', handleError);
    mv.addEventListener('ar-status', handleArStatus);
    return () => {
      setIsWebArReady(false);
      mv.removeEventListener('load', handleLoad);
      mv.removeEventListener('error', handleError);
      mv.removeEventListener('ar-status', handleArStatus);
    };
  }, [arModelUrl, isIos, setArPresenting, setArError, closeArSession]);

  const handleLaunchWebAr = async () => {
    const mv = modelViewerRef.current;
    if (!mv || typeof mv.activateAR !== 'function' || mv.canActivateAR === false) {
      setArError('WebXR AR session is not available on this device.');
      return;
    }

    try {
      await mv.activateAR();
    } catch (error) {
      console.error('Failed to activate WebXR AR session:', error);
      setArError('Could not launch WebXR AR session.');
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
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
      className="w-screen h-[100dvh] relative bg-[#050505] selection:bg-blue-500/30 font-sans overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#080808] to-[#000000] pointer-events-none" />

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

      {/* Standalone 1:1 Physical Centimeter Ruler */}
      <ScreenRuler />

      {/* Full Screen Calibration Modal */}
      <CalibrationModal />

      {/* AR Export & Launch Modal */}
      <ArLaunchModal
        onLaunchWebAr={() => void handleLaunchWebAr()}
        isWebArReady={isWebArReady}
      />

      {/* 1:1 Scale Aura Effect */}
      <AuraEffect />

      {/* Offscreen Model Viewer for WebXR AR */}
      {isArSupported && !isIos && (
        <model-viewer
          ref={modelViewerRef}
          src={arModelUrl || undefined}
          ar
          ar-modes="webxr"
          ar-scale="fixed"
          camera-controls
          style={{
            display: 'block',
            width: '1px',
            height: '1px',
            position: 'fixed',
            bottom: 0,
            right: 0,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      )}
    </main>
  );
}

export default App;
